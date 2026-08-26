import { isSbV2MetaEnv } from '@edanalytics/models';
import { EdfiTenant, SbEnvironment, regarding } from '@edanalytics/models-server';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import config from 'config';
import { Repository } from 'typeorm';
import {
  StartingBlocksServiceV1,
  StartingBlocksServiceV2,
} from '../teams/edfi-tenants/starting-blocks';
import { MetadataService } from '../teams/edfi-tenants/starting-blocks/metadata.service';
import { CustomHttpException } from '../utils/customExceptions';
import { jsonValue } from '../utils/db-json-query';
import {
  ENV_SYNC_CHNL,
  SYNC_SCHEDULER_CHNL,
  TENANT_SYNC_CHNL,
} from './sb-sync.module';
import { AdminApiSyncService } from './edfi/adminapi-sync.service';
import { IJobQueueService, Job } from './job-queue/job-queue.interface';

@Injectable()
export class SbSyncConsumer implements OnModuleInit {
  constructor(
    @InjectRepository(SbEnvironment)
    private sbEnvironmentsRepository: Repository<SbEnvironment>,
    @InjectRepository(EdfiTenant)
    private edfiTenantsRepository: Repository<EdfiTenant>,
    @Inject('IJobQueueService')
    private readonly jobQueue: IJobQueueService,
    private readonly sbServiceV1: StartingBlocksServiceV1,
    private readonly sbServiceV2: StartingBlocksServiceV2,
    private readonly metadataService: MetadataService,
    private readonly adminapiSyncService: AdminApiSyncService
  ) {}
  public async onModuleDestroy() {
    await this.jobQueue.stop();
  }
  public async onModuleInit() {
    try {
      // pg-boss v12: queues must exist in pgboss.queue before schedule() or work() can reference them.
      await this.jobQueue.createQueue(SYNC_SCHEDULER_CHNL);
      await this.jobQueue.createQueue(ENV_SYNC_CHNL);
      await this.jobQueue.createQueue(TENANT_SYNC_CHNL);
      await this.jobQueue.schedule(SYNC_SCHEDULER_CHNL, config.SB_SYNC_CRON, null, {
        tz: 'America/Chicago',
      });
      Logger.log('Sync scheduler job scheduled successfully');
    } catch (error) {
      if ((error as Error & { status?: number })?.status === 503) {
        Logger.warn(
          'Database unavailable - sync scheduler will be set up when database becomes available'
        );
      } else {
        Logger.error('Failed to schedule sync job:', error);
        throw error;
      }
    }

    try {
      await this.jobQueue.work(SYNC_SCHEDULER_CHNL, async () => {
        const sbEnvironments = await this.sbEnvironmentsRepository
          .createQueryBuilder()
          .select()
          .where(`${jsonValue('configPublic', 'sbEnvironmentMetaArn', config.DB_ENGINE)} is not null`)
          .getMany();

        Logger.log(`Starting sync for ${sbEnvironments.length} environments.`);
        await Promise.all(
          sbEnvironments.map((sbEnvironment) =>
            this.jobQueue.send(
              ENV_SYNC_CHNL,
              { sbEnvironmentId: sbEnvironment.id },
              { singletonKey: String(sbEnvironment.id), expireInHours: 1 }
            )
          )
        );

        const adminApiEnvironments = await this.sbEnvironmentsRepository
          .createQueryBuilder()
          .select()
          .where(`${jsonValue('configPublic', 'adminApiUrl', config.DB_ENGINE)} is not null`)
          .andWhere(`${jsonValue('configPublic', 'sbEnvironmentMetaArn', config.DB_ENGINE)} is null`)
          .getMany();

        Logger.log(`Starting Admin API refresh for ${adminApiEnvironments.length} environments.`);
        await Promise.all(
          adminApiEnvironments.map((env) =>
            this.jobQueue.send(
              ENV_SYNC_CHNL,
              { sbEnvironmentId: env.id },
              { singletonKey: String(env.id), expireInHours: 1 }
            )
          )
        );
      });

      await this.jobQueue.work(ENV_SYNC_CHNL, async (job: Job<{ sbEnvironmentId: number }>) => {
        return this.refreshSbEnvironment(job.data.sbEnvironmentId);
      });

      await this.jobQueue.work(TENANT_SYNC_CHNL, async (job: Job<{ edfiTenantId: number }>) => {
        return this.refreshEdfiTenant(job.data.edfiTenantId);
      });

      Logger.log('Sync workers registered successfully');
    } catch (error) {
      if ((error as Error & { status?: number })?.status === 503) {
        Logger.warn(
          'Database unavailable - sync workers will be registered when database becomes available'
        );
      } else {
        Logger.error('Failed to register sync workers:', error);
        throw error;
      }
    }

    // Explicitly start the queue after workers are registered. This is safe to call even if
    // onApplicationBootstrap already started it — start() is idempotent.
    await this.jobQueue.start();
  }

  async refreshSbEnvironment(sbEnvironmentId: number) {
    let sbEnvironment = await this.sbEnvironmentsRepository
      .createQueryBuilder()
      .select()
      .where(`${jsonValue('configPublic', 'sbEnvironmentMetaArn', config.DB_ENGINE)} is not null and id = :id`, {
        id: sbEnvironmentId,
      })
      .getOne();
    if (sbEnvironment === null) {
      //try to find a syncable environment EdFi (with Admin API)
      sbEnvironment = await this.sbEnvironmentsRepository
        .createQueryBuilder()
        .select()
        .where(`${jsonValue('configPublic', 'adminApiUrl', config.DB_ENGINE)} is not null and id = :id`, {
          id: sbEnvironmentId,
        })
        .getOne();
      if (sbEnvironment === null)
        throw new NotFoundException(`No syncable environment found with id ${sbEnvironmentId}`);

      const adminApiSyncResult = await this.adminapiSyncService.syncEnvironmentData(sbEnvironment);
      if (adminApiSyncResult.status !== 'SUCCESS') {
        throw new BadRequestException(
          `Failed to sync environment ${sbEnvironment.name} via Admin API: ${adminApiSyncResult.message}`
        );
      }
      return {
        tenantsProcessed: adminApiSyncResult.tenantsProcessed || 0,
        message: adminApiSyncResult.message,
      };

    } else {
      // Use the lambda function to get metadata
      const sbMeta = await this.metadataService.getMetadata(sbEnvironment);
      if (sbMeta.status === 'NO_CONFIG') {
        throw new CustomHttpException(
          {
            type: 'Error',
            title: 'Metadata retrieval failed.',
            message: 'Bad config for metadata lambda function.',
            regarding: regarding(sbEnvironment),
          },
          500
        );
      } else if (sbMeta.status !== 'SUCCESS') {
        throw new CustomHttpException(
          {
            type: 'Error',
            title: 'Matadata retrieval failed.',
            message: sbMeta.error,
            regarding: regarding(sbEnvironment),
          },
          500
        );
      }
      let result: Awaited<
        ReturnType<
          | StartingBlocksServiceV1['syncEnvironmentEverything']
          | StartingBlocksServiceV2['syncEnvironmentEverything']
        >
      >;
      if (isSbV2MetaEnv(sbMeta.data)) {
        result = await this.sbServiceV2.syncEnvironmentEverything(sbEnvironment, sbMeta.data);
      } else {
        result = await this.sbServiceV1.syncEnvironmentEverything(sbEnvironment, sbMeta.data);
      }
      if (result.status !== 'SUCCESS') {
        throw result;
      } else {
        return result.data;
      }
    }
  }

  async refreshEdfiTenant(edfiTenantId: number) {
    const edfiTenant = await this.edfiTenantsRepository.findOne({
      where: {
        id: edfiTenantId,
      },
      relations: ['sbEnvironment'],
    });
    const sbEnvironment = edfiTenant.sbEnvironment;
    const sbMeta = await this.metadataService.getMetadata(sbEnvironment);

    if (!sbEnvironment.startingBlocks)
    {
      const result = await this.adminapiSyncService.syncTenantData(edfiTenant);
      if (result.status !== 'SUCCESS') {
        throw new BadRequestException(
          `Failed to sync tenant ${edfiTenant.name} via Admin API: ${result.message}`
        );
      }
      return {
        message: result.message,
      };
    }
    else
    {
      if (sbMeta.status === 'NO_CONFIG') {
      throw new CustomHttpException(
        {
          type: 'Error',
          title: 'Metadata retrieval failed.',
          message: 'Bad config for metadata lambda function.',
          regarding: regarding(sbEnvironment),
        },
        500
      );
    } else if (sbMeta.status !== 'SUCCESS') {
      throw new CustomHttpException(
        {
          type: 'Error',
          title: 'Matadata retrieval failed.',
          message: sbMeta.error,
          regarding: regarding(sbEnvironment),
        },
        500
      );
    }
    let result: Awaited<
      ReturnType<
        | StartingBlocksServiceV1['syncTenantResourceTree']
        | StartingBlocksServiceV2['syncTenantResourceTree']
      >
    >;
    if (isSbV2MetaEnv(sbMeta.data)) {
      result = await this.sbServiceV2.syncTenantResourceTree(edfiTenant);
    } else {
      result = await this.sbServiceV1.syncTenantResourceTree(edfiTenant, sbMeta.data);
    }
    if (result.status !== 'SUCCESS') {
      throw result;
    } else {
      return result.data;
    }
    }
  }
}
