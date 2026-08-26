import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SbEnvironment, SbSyncQueue } from '@edanalytics/models-server';
import type { SbEnvironmentConfigPublic, SbV3MetaEnv } from '@edanalytics/models';
import { randomUUID } from 'crypto';
import { AdminApiServiceV3 } from '../teams/edfi-tenants/starting-blocks';
import { IJobQueueService } from '../sb-sync/job-queue/job-queue.interface';
import { V2AdminApiVersionStrategy } from './v2-admin-api-version.strategy';
import { AnyAdminApiService, BuildConfigPublicInput } from './admin-api-version-strategy.interface';

@Injectable()
export class V3AdminApiVersionStrategy extends V2AdminApiVersionStrategy {
  readonly version: 'v1' | 'v2' | 'v3' = 'v3';

  constructor(
    @Inject('IJobQueueService')
    jobQueue: IJobQueueService,
    @InjectRepository(SbSyncQueue)
    queueRepository: Repository<SbSyncQueue>,
    @InjectRepository(SbEnvironment)
    sbEnvironmentsRepository: Repository<SbEnvironment>,
    private readonly adminApiServiceV3: AdminApiServiceV3
  ) {
    // Keep the same constructor parameter order/positions as V2AdminApiVersionStrategy
    // (decorated params first, admin-api-service param last) so Nest's inherited
    // self-declared-dependency metadata resolves the right token for each position.
    // V2's adminApiServiceV2 param is optional; V3 overrides getAdminApiService()
    // below and never touches it, so we don't need to provide one.
    super(jobQueue, queueRepository, sbEnvironmentsRepository);
  }

  getAdminApiService(): AnyAdminApiService {
    return this.adminApiServiceV3;
  }

  buildConfigPublic({ createSbEnvironmentDto, odsApiMetaResponse, tenantMode }: BuildConfigPublicInput) {
    return {
      startingBlocks: createSbEnvironmentDto.startingBlocks,
      odsApiMeta: odsApiMetaResponse,
      adminApiUrl: createSbEnvironmentDto.adminApiUrl,
      version: 'v3' as const,
      values: {
        meta: {
          envlabel: createSbEnvironmentDto.environmentLabel,
          mode: tenantMode,
          domainName: createSbEnvironmentDto.odsApiDiscoveryUrl,
          adminApiUrl: createSbEnvironmentDto.adminApiUrl,
          tenantManagementFunctionArn: '',
          tenantResourceTreeFunctionArn: '',
          odsManagementFunctionArn: '',
          edorgManagementFunctionArn: '',
          dataFreshnessFunctionArn: '',
        } satisfies SbV3MetaEnv,
        adminApiUuid: randomUUID(),
      },
    } as SbEnvironmentConfigPublic;
  }
}
