import {
  GetSessionDataDto,
  Id,
  PgBossJobState,
  PostEdfiTenantDto,
  PutEdfiTenantAdminApi,
  PutEdfiTenantAdminApiRegister,
  toGetEdfiTenantDto,
  toOperationResultDto,
  toSbSyncQueueDto,
} from '@edanalytics/models';
import {
  EdfiTenant,
  SbEnvironment,
  SbSyncQueue,
  addUserCreating,
  addUserModifying,
  regarding,
} from '@edanalytics/models-server';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
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
  ReqEdfiTenant,
  ReqSbEnvironment,
  SbEnvironmentEdfiTenantInterceptor,
} from '../app/sb-environment-edfi-tenant.interceptor';
import { Authorize } from '../auth/authorization';
import { ReqUser } from '../auth/helpers/user.decorator';
import { SbEnvironmentsGlobalService } from '../sb-environments-global/sb-environments-global.service';
import { TENANT_SYNC_CHNL } from '../sb-sync/sb-sync.module';
import { IJobQueueService } from '../sb-sync/job-queue/job-queue.interface';
import { adminApiSelfRegisterFailureMsgs } from '../teams/edfi-tenants/adminApiLoginFailureMsgs';
import { EdfiTenantsService } from '../teams/edfi-tenants/edfi-tenants.service';
import {
  StartingBlocksServiceV1,
  StartingBlocksServiceV2,
} from '../teams/edfi-tenants/starting-blocks';
import { throwNotFound } from '../utils';
import { CustomHttpException, ValidationHttpException } from '../utils/customExceptions';
import { Operation, SbVersion } from '../auth/authorization/sbVersion.decorator';

@ApiTags('EdfiTenant - Global')
@UseInterceptors(SbEnvironmentEdfiTenantInterceptor)
@Controller()
export class EdfiTenantsGlobalController {
  constructor(
    private readonly edfiTenantService: EdfiTenantsService,
    private readonly sbEnvironmentService: SbEnvironmentsGlobalService,
    private readonly startingBlocksServiceV2: StartingBlocksServiceV2,
    private readonly startingBlocksServiceV1: StartingBlocksServiceV1,
    @InjectRepository(EdfiTenant)
    private edfiTenantsRepository: Repository<EdfiTenant>,
    @Inject('IJobQueueService')
    private readonly jobQueue: IJobQueueService,
    @InjectRepository(SbSyncQueue) private readonly queueRepository: Repository<SbSyncQueue>
  ) {}

  @SbVersion('v2')
  @Operation('Creating tenants')
  @Post()
  @Authorize({
    privilege: 'sb-environment.edfi-tenant:create',
    subject: {
      id: '__filtered__',
    },
  })
  async post(
    @Param('sbEnvironmentId', new ParseIntPipe()) sbEnvironmentId: number,
    @ReqSbEnvironment() sbEnvironment: SbEnvironment,
    @Body() tenant: PostEdfiTenantDto,
    @ReqUser() user: GetSessionDataDto
  ) {
    return this.edfiTenantService.create(sbEnvironment, addUserCreating(tenant, user));
  }

  @Get()
  @Authorize({
    privilege: 'sb-environment.edfi-tenant:read',
    subject: {
      id: '__filtered__',
    },
  })
  async findAll(@Param('sbEnvironmentId', new ParseIntPipe()) sbEnvironmentId: number) {
    return toGetEdfiTenantDto(await this.edfiTenantsRepository.findBy({ sbEnvironmentId }));
  }

  @Get(':edfiTenantId')
  @Authorize({
    privilege: 'sb-environment.edfi-tenant:read',
    subject: {
      id: 'edfiTenantId',
    },
  })
  async findOne(@Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number) {
    return toGetEdfiTenantDto(
      await this.edfiTenantsRepository.findOneByOrFail({ id: edfiTenantId }).catch(throwNotFound)
    );
  }

  @SbVersion('v2')
  @Operation('Deleting tenants')
  @Delete(':edfiTenantId')
  @Authorize({
    privilege: 'sb-environment.edfi-tenant:delete',
    subject: {
      id: 'edfiTenantId',
    },
  })
  remove(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @ReqSbEnvironment() sbEnvironment: SbEnvironment,
    @ReqUser() _user: GetSessionDataDto
  ) {
    return this.edfiTenantService.delete(sbEnvironment, edfiTenant);
  }

  @Put(':edfiTenantId/refresh-resources')
  @Authorize({
    privilege: 'sb-environment.edfi-tenant:refresh-resources',
    subject: {
      id: 'edfiTenantId',
    },
  })
  async refreshResources(@Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number) {
    const id = await this.jobQueue.send(
      TENANT_SYNC_CHNL,
      { edfiTenantId: edfiTenantId },
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
        if (i === 20 || !pendingState.includes(queueItem?.state)) {
          clearInterval(timer);
          r(toSbSyncQueueDto(queueItem));
        }
        i++;
      }
    });
  }

  @Put(':edfiTenantId/check-admin-api')
  @Authorize({
    privilege: 'sb-environment.edfi-tenant:read',
    subject: {
      id: 'edfiTenantId',
    },
  })
  async checkAdminAPI(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant
  ) {
    return await this.edfiTenantService.pingAdminApi(edfiTenant);
  }

  @Put(':edfiTenantId/update-admin-api')
  @Authorize({
    privilege: 'sb-environment.edfi-tenant:update',
    subject: {
      id: 'edfiTenantId',
    },
  })
  async updateAdminApi(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @ReqSbEnvironment() sbEnvironment: SbEnvironment,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Body() updateDto: PutEdfiTenantAdminApi,
    @ReqUser() user: GetSessionDataDto
  ) {
    return this.sbEnvironmentService.updateAdminApi(
      sbEnvironment,
      edfiTenant,
      addUserModifying(updateDto, user)
    );
  }

  @Put(':edfiTenantId/admin-api-v2-keygen')
  @Authorize({
    privilege: 'sb-environment.edfi-tenant:update',
    subject: {
      id: 'edfiTenantId',
    },
  })
  async adminApiKeygen(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @ReqSbEnvironment() sbEnvironment: SbEnvironment,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Body() _updateDto: Id,
    @ReqUser() _user: GetSessionDataDto
  ) {
    const result = await this.startingBlocksServiceV2.regenerateAdminApiCredentials(edfiTenant);
    switch (result.status) {
      case 'FAILURE':
        throw new CustomHttpException(
          {
            title: 'Failed to generate Admin API key for new tenant.',
            type: 'Error',
          },
          500
        );
      case 'NO_CONFIG':
        throw new CustomHttpException(
          {
            title: 'No ARN configured for tenant management.',
            type: 'Error',
          },
          500
        );
      case 'SUCCESS':
        return toOperationResultDto({
          title: 'Key generated successfully.',
          type: 'Success',
          regarding: regarding(edfiTenant),
        });
    }
  }
  @Put(':edfiTenantId/register-admin-api')
  @Authorize({
    privilege: 'sb-environment.edfi-tenant:update',
    subject: {
      id: 'edfiTenantId',
    },
  })
  async registerAdminApi(
    @Param('sbEnvironmentId', new ParseIntPipe()) sbEnvironmentId: number,
    @ReqSbEnvironment() sbEnvironment: SbEnvironment,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Body() updateDto: PutEdfiTenantAdminApiRegister,
    @ReqUser() user: GetSessionDataDto
  ) {
    if (sbEnvironment.version !== 'v1') {
      throw new BadRequestException('Only v1 environments support this operation.');
    }
    const result = await this.sbEnvironmentService.selfRegisterAdminApiV1(
      sbEnvironment,
      addUserModifying(updateDto, user)
    );
    if (
      result.status === 'ENOTFOUND' ||
      result.status === 'NOT_FOUND' ||
      result.status === 'SELF_REGISTRATION_NOT_ALLOWED'
    ) {
      throw new ValidationHttpException({
        field: 'adminRegisterUrl',
        message: adminApiSelfRegisterFailureMsgs[result.status],
      });
    } else if (result.status === 'ERROR') {
      throw new CustomHttpException(
        {
          type: 'Error',
          title: adminApiSelfRegisterFailureMsgs[result.status],
          regarding: regarding(sbEnvironment),
          message: 'message' in result ? result.message : undefined,
          data: 'data' in result ? result.data : undefined,
        },
        400
      );
    } else if (result.status === 'SUCCESS') {
      return toOperationResultDto({
        title: 'Configuration updated successfully.',
        type: 'Success',
        regarding: regarding(edfiTenant),
      });
    }
  }
}
