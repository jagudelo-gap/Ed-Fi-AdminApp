import { validate } from '@aws-sdk/util-arn-parser';
import {
  GetSessionDataDto,
  Id,
  PgBossJobState,
  PostSbEnvironmentDto,
  PutSbEnvironmentDto,
  PutSbEnvironmentMeta,
  toGetSbEnvironmentDto,
  toOperationResultDto,
  toPostSbEnvironmentResponseDto,
  toSbSyncQueueDto,
} from '@edanalytics/models';
import {
  SbEnvironment,
  SbSyncQueue,
  addUserCreating,
  addUserModifying,
} from '@edanalytics/models-server';

import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Logger,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ReqSbEnvironment,
  SbEnvironmentEdfiTenantInterceptor,
} from '../app/sb-environment-edfi-tenant.interceptor';
import { Authorize } from '../auth/authorization';
import { ReqUser } from '../auth/helpers/user.decorator';
import { ENV_SYNC_CHNL } from '../sb-sync/sb-sync.module';
import { IJobQueueService } from '../sb-sync/job-queue/job-queue.interface';
import {
  CustomHttpException,
  determineTenantModeFromMetadata,
  fetchAdminApiInfo,
  fetchOdsApiMetadata,
  throwNotFound,
  validateAdminApiUrl,
  validateTenantModeCompatibility,
  ValidationHttpException,
} from '../utils';
import { SbEnvironmentsGlobalService } from './sb-environments-global.service';
import { StartingBlocksServiceV2 } from '../teams/edfi-tenants/starting-blocks';
import { Operation, SbVersion } from '../auth/authorization/sbVersion.decorator';
import { SbEnvironmentsEdFiService } from './sb-environments-edfi.services';

@ApiTags('SbEnvironment - Global')
@UseInterceptors(SbEnvironmentEdfiTenantInterceptor)
@Controller()
export class SbEnvironmentsGlobalController {
  constructor(
    private readonly sbEnvironmentService: SbEnvironmentsGlobalService,
    private readonly sbEnvironmentEdFiService: SbEnvironmentsEdFiService,
    @InjectRepository(SbEnvironment)
    private sbEnvironmentsRepository: Repository<SbEnvironment>,
    private startingBlocksServiceV2: StartingBlocksServiceV2,
    @Inject('IJobQueueService')
    private readonly jobQueue: IJobQueueService,
    @InjectRepository(SbSyncQueue) private readonly queueRepository: Repository<SbSyncQueue>
  ) {}

  /**
   * Creates a detailed response object for SbEnvironment with computed properties and tenant/ODS data
   * Used by findOne method
   */
  private createDetailedEnvironmentResponse(environment: SbEnvironment) {
    const dto = toGetSbEnvironmentDto(environment);

    return {
      id: environment.id,
      created: environment.created,
      modified: environment.modified,
      createdById: environment.createdById,
      modifiedById: environment.modifiedById,
      envLabel: environment.envLabel,
      configPublic: environment.configPublic,
      name: environment.name,
      // Include edfiTenants with ODS data for edit form
      edfiTenants: environment.edfiTenants?.map(tenant => ({
        id: tenant.id,
        name: tenant.name,
        displayName: tenant.name,
        sbEnvironmentId: tenant.sbEnvironmentId,
        odss: tenant.odss?.map(ods => ({
          id: ods.id,
          name: ods.odsInstanceName || ods.dbName,
          dbName: ods.dbName,
          // Handle both cases: educationOrganizationId for findOne, id for update
          allowedEdOrgs: ods.edorgs?.map(edorg => edorg.educationOrganizationId || edorg.id).join(', ') || '',
          edfiTenantId: ods.edfiTenantId,
          sbEnvironmentId: ods.sbEnvironmentId,
        })) || []
      })) || [],
      // Add computed properties from the DTO directly in the object literal
      displayName: dto.displayName,
      version: dto.version,
      domain: dto.domain,
      usableDomain: dto.usableDomain,
      odsApiVersion: dto.odsApiVersion,
      odsDsVersion: dto.odsDsVersion,
      adminApiUrl: dto.adminApiUrl,
      startingBlocks: dto.startingBlocks,
      multiTenant: dto.multiTenant,
    };
  }

  @Post()
  @Authorize({
    privilege: 'sb-environment:create',
    subject: {
      id: '__filtered__',
    },
  })
  async create(
    @Body() createSbEnvironmentDto: PostSbEnvironmentDto,
    @ReqUser() user: GetSessionDataDto
  ) {
    if (createSbEnvironmentDto.metaArn) {
      if (!validate(createSbEnvironmentDto.metaArn)) {
        throw new ValidationHttpException({
          field: 'metaArn',
          message: 'Invalid ARN. This field is optional.',
        });
      }
      const sbEnvironment = await this.sbEnvironmentsRepository.save(
        addUserCreating(
          this.sbEnvironmentsRepository.create({
            name: createSbEnvironmentDto.name,
            configPublic: {
              startingBlocks: createSbEnvironmentDto.startingBlocks,
              sbEnvironmentMetaArn: createSbEnvironmentDto.metaArn,
            },
          }),
          user
        )
      );
      const id = await this.jobQueue.send(
        ENV_SYNC_CHNL,
        { sbEnvironmentId: sbEnvironment.id },
        { expireInHours: 2 }
      );
      const repo = this.queueRepository;
      return new Promise((r) => {
        let queueItem: SbSyncQueue;
        const timer = setInterval(poll, 500);
        const pendingState: PgBossJobState[] = ['created', 'retry', 'active'];
        let i = 0;
        async function poll() {
          queueItem = await repo.findOneBy({ id });
          if (i === 20 || !pendingState.includes(queueItem.state)) {
            clearInterval(timer);
            r(
              toPostSbEnvironmentResponseDto({
                id: sbEnvironment.id,
                syncQueue: toSbSyncQueueDto(queueItem),
              })
            );
          }
          i++;
        }
      });
    } else {
      const response = await this.sbEnvironmentEdFiService.create(createSbEnvironmentDto, user);
      return toPostSbEnvironmentResponseDto(response);
    }
  }

  @Get()
  @Authorize({
    privilege: 'sb-environment:read',
    subject: {
      id: '__filtered__',
    },
  })
  async findAll() {
    return toGetSbEnvironmentDto(await this.sbEnvironmentsRepository.find());
  }

  @Post('checkEdFiVersionAndTenantMode')
  @Authorize({
    privilege: 'sb-environment:create',
    subject: {
      id: '__filtered__',
    },
  })
  async checkEdFiVersionAndTenantMode(
    @Body() body: { odsApiDiscoveryUrl: string; adminApiUrl?: string }
  ) {
    const { odsApiDiscoveryUrl, adminApiUrl } = body;
    // Fetch ODS API metadata
    const odsApiMetaResponse = await fetchOdsApiMetadata({ odsApiDiscoveryUrl } as PostSbEnvironmentDto);

    // Fetch Admin API info if URL provided (to get multitenantMode field)
    let adminApiInfo;
    if (adminApiUrl) {
      try {
        adminApiInfo = await fetchAdminApiInfo(adminApiUrl);
      } catch (adminApiError) {
        // Log warning but don't fail - we can still determine mode from ODS API
        Logger.warn('Failed to fetch Admin API info for tenant mode detection, falling back to ODS API:', adminApiError.message);
      }
    }

    // Auto-detect tenant mode from metadata - prioritizes Admin API field
    const tenantMode = determineTenantModeFromMetadata(odsApiMetaResponse, adminApiInfo);
    const isMultiTenant = tenantMode === 'MultiTenant';

    // Validate tenant mode compatibility if both APIs are available
    if (adminApiUrl && adminApiInfo) {
      // Only validate if Admin API explicitly defines multitenantMode
      if (adminApiInfo?.tenancy?.multitenantMode !== undefined) {
        const odsTenantMode = determineTenantModeFromMetadata(odsApiMetaResponse);
        const adminTenantMode = adminApiInfo.tenancy.multitenantMode ? 'MultiTenant' : 'SingleTenant';
        validateTenantModeCompatibility(odsTenantMode, adminTenantMode);
      } else {
        Logger.log('Admin API does not provide multitenantMode field, skipping tenant mode compatibility check');
      }
    }

    return {
      odsVersion: odsApiMetaResponse ? odsApiMetaResponse.version : '',
      version: adminApiInfo ? adminApiInfo.specificationVersion : '',
      isMultiTenant: isMultiTenant
    };
  }

  @Post('validateAdminApiUrl')
  @Authorize({
    privilege: 'sb-environment:create',
    subject: {
      id: '__filtered__',
    },
  })
  async validateAdminApiUrl(@Body() body: { adminApiUrl: string, odsApiDiscoveryUrl:string }) {
    const { adminApiUrl, odsApiDiscoveryUrl } = body;
    await validateAdminApiUrl(adminApiUrl, odsApiDiscoveryUrl);
    return { valid: true, message: 'Management API URL is valid' };
  }

  @Get(':sbEnvironmentId')
  @Authorize({
    privilege: 'sb-environment:read',
    subject: {
      id: '__filtered__',
    },
  })
  async findOne(
    @Param('sbEnvironmentId', new ParseIntPipe())
    sbEnvironmentId: number
  ) {
    // Load environment with tenant and ODS relations for the edit page
    const environment = await this.sbEnvironmentsRepository.findOne({
      where: { id: sbEnvironmentId },
      relations: ['edfiTenants', 'edfiTenants.odss', 'edfiTenants.odss.edorgs'],
    });

    if (!environment) {
      throwNotFound(new Error(`Environment with id ${sbEnvironmentId} not found`));
    }

    return this.createDetailedEnvironmentResponse(environment);
  }

  @Put(':sbEnvironmentId')
  @Authorize({
    privilege: 'sb-environment:update',
    subject: {
      id: '__filtered__',
    },
  })
  async update(
    @Param('sbEnvironmentId', new ParseIntPipe())
    sbEnvironmentId: number,
    @Body() updateSbEnvironmentDto: PutSbEnvironmentDto,
    @ReqUser() user: GetSessionDataDto
  ) {
    const { environment, syncQueue } = await this.sbEnvironmentEdFiService.updateEnvironment(
      sbEnvironmentId,
      updateSbEnvironmentDto,
      user
    );
    const detailed = this.createDetailedEnvironmentResponse(environment);
    return syncQueue ? { ...detailed, syncQueue } : detailed;
  }

  @Delete(':sbEnvironmentId')
  @Authorize({
    privilege: 'sb-environment:delete',
    subject: {
      id: '__filtered__',
    },
  })
  remove(
    @Param('sbEnvironmentId', new ParseIntPipe())
    sbEnvironmentId: number,
    @ReqUser() user: GetSessionDataDto
  ) {
    return this.sbEnvironmentService.remove(sbEnvironmentId, user);
  }
  @Put(':sbEnvironmentId/meta-arn')
  @Authorize({
    privilege: 'sb-environment.edfi-tenant:update',
    subject: {
      id: '__filtered__',
    },
  })
  async updateSbMeta(
    @Param('sbEnvironmentId', new ParseIntPipe()) sbEnvironmentId: number,
    @Body() updateDto: PutSbEnvironmentMeta,
    @ReqUser() user: GetSessionDataDto
  ) {
    return toGetSbEnvironmentDto(
      await this.sbEnvironmentService.updateMetadataArn(
        sbEnvironmentId,
        addUserModifying(updateDto, user)
      )
    );
  }

  @SbVersion('v2')
  @Operation('Reloading tenants')
  @Put(':sbEnvironmentId/reload-tenants')
  @Authorize({
    privilege: 'sb-environment.edfi-tenant:update',
    subject: {
      id: '__filtered__',
    },
  })
  async reloadTenants(
    @Param('sbEnvironmentId', new ParseIntPipe()) sbEnvironmentId: number,
    @Body() updateDto: Id,
    @ReqUser() user: GetSessionDataDto,
    @ReqSbEnvironment() sbEnvironment: SbEnvironment
  ) {
    const result = await this.startingBlocksServiceV2.tenantMgmtService.reload(sbEnvironment);
    if (result.status !== 'SUCCESS') {
      throw new CustomHttpException(
        {
          title: 'Failed to reload tenants in Starting Blocks',
          type: 'Error',
          message: result.status,
        },
        500
      );
    }
    return toOperationResultDto({
      title: 'Reload triggered successfully',
      message: typeof result?.data === 'string' ? result.data : undefined,
      type: 'Success',
    });
  }
  @Put(':sbEnvironmentId/refresh-resources')
  @Authorize({
    privilege: 'sb-environment:refresh-resources',
    subject: {
      id: 'sbEnvironmentId',
    },
  })
  async refreshResources(@Param('sbEnvironmentId', new ParseIntPipe()) sbEnvironmentId: number) {
    const id = await this.jobQueue.send(
      ENV_SYNC_CHNL,
      { sbEnvironmentId: sbEnvironmentId },
      { expireInHours: 2 }
    );
    const repo = this.queueRepository;
    return new Promise((r) => {
      let queueItem: SbSyncQueue;
      const timer = setInterval(poll, 500);
      const pendingState: PgBossJobState[] = ['created', 'retry', 'active'];
      let i = 0;
      async function poll() {
        queueItem = await repo.findOneBy({ id });
        if (i === 20 || !pendingState.includes(queueItem.state)) {
          clearInterval(timer);
          r(toSbSyncQueueDto(queueItem));
        }
        i++;
      }
    });
  }
}
