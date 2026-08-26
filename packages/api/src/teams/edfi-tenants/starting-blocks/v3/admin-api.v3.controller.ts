import {
  CopyClaimsetDtoV3,
  GetApiClientDtoV3,
  GetApplicationDtoV3,
  GetClaimsetSingleDtoV3,
  GetIntegrationAppDto,
  Id,
  Ids,
  ImportClaimsetSingleDtoV3,
  PostApplicationDtoV3,
  PostApiClientDtoV3,
  PostApplicationFormDtoV3,
  PostInstanceDtoV3,
  PutApiClientDtoV3,
  PostClaimsetDtoV3,
  PostProfileDtoV3,
  PostVendorDtoV3,
  PutApplicationDtoV3,
  PutApplicationFormDtoV3,
  PutClaimsetDtoV3,
  PutProfileDtoV3,
  PutVendorDtoV3,
  SecretSharingMethod,
  edorgKeyV2,
  toApiClientYopassResponseDto,
  toApplicationYopassResponseDto,
  toPostApiClientResponseDtoV3,
  toPostApplicationResponseDtoV3,
} from '@edanalytics/models';
import { EdfiTenant, Edorg, Ods, SbEnvironment } from '@edanalytics/models-server';
import {
  BadRequestException,
  Body,
  CallHandler,
  Controller,
  Delete,
  ExecutionContext,
  ForbiddenException,
  Get,
  HttpException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NestInterceptor,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { instanceToPlain, plainToInstance } from 'class-transformer';
import { Response } from 'express';
import NodeCache from 'node-cache';
import { In, Repository } from 'typeorm';
import {
  ReqEdfiTenant,
  ReqSbEnvironment,
  SbEnvironmentEdfiTenantInterceptor,
} from '../../../../app/sb-environment-edfi-tenant.interceptor';
import { Authorize } from '../../../../auth/authorization';
import { InjectFilter } from '../../../../auth/helpers/inject-filter';
import { checkId } from '../../../../auth/helpers/where-ids';
import {
  CustomHttpException,
  ValidationHttpException,
  asBool,
  isIAdminApiValidationError,
  postYopassSecret,
} from '../../../../utils';
import { AdminApiV3ExceptionFilter } from './admin-api-v3-exception.filter';
import { AdminApiServiceV3 } from './admin-api.v3.service';
import { IntegrationAppsTeamService } from '../../../../integration-apps-team/integration-apps-team.service';
import { ENV_SYNC_CHNL } from '../../../../sb-sync/sb-sync.module';
import { IJobQueueService } from '../../../../sb-sync/job-queue/job-queue.interface';
import config from 'config';

@Injectable()
class AdminApiV3Interceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const configPublic = request.sbEnvironment.configPublic;
    if (!('version' in configPublic && configPublic.version === 'v3')) {
      throw new NotFoundException(
        `Requested Admin API version not correct for this EdfiTenant. Use "${request.sbEnvironment.configPublic.adminApiVersion}" instead.`,
      );
    }
    return next.handle();
  }
}

@UseFilters(new AdminApiV3ExceptionFilter())
@UseInterceptors(SbEnvironmentEdfiTenantInterceptor, AdminApiV3Interceptor)
@ApiTags('Admin API Resources - v3.x')
@Controller()
export class AdminApiControllerV3 {
  private downloadCache = new NodeCache({ stdTTL: 60 * 5 /* 5 minutes */ });
  constructor(
    private readonly integrationAppsTeamService: IntegrationAppsTeamService,
    private readonly sbService: AdminApiServiceV3,
    @InjectRepository(Edorg) private readonly edorgRepository: Repository<Edorg>,
    @InjectRepository(Ods) private readonly odsRepository: Repository<Ods>,
    @Inject('IJobQueueService') private readonly jobQueue: IJobQueueService,
  ) {}

  /** Check application edorg IDs against auth cache for _safe_ operations (GET). Requires `some` ID to be authorized. */
  private checkApplicationEdorgsForSafeOperations(
    application: Pick<GetApplicationDtoV3, 'educationOrganizationIds' | 'dataStoreIds'>,
    validIds: Ids,
  ) {
    return application.dataStoreIds.some((dataStoreId) =>
      application.educationOrganizationIds.some((edorgId) =>
        checkId(
          edorgKeyV2({
            edorg: edorgId,
            ods: dataStoreId,
          }),
          validIds,
        ),
      ),
    );
  }

  /** Check application edorg IDs against auth cache for _unsafe_ operations (POST/PUT/DELETE). Requires `every` ID to be authorized.
   * Note that IDs which don't exist in SBAA &mdash; either because they haven't synced yet or because they don't exist in EdFi &mdash; can
   * never be authorized via an Edorg or Ods ownership, but _can_ be via an EdfiTenant or SbEnvironment ownership. This is due to some
   * quirks in the SBAA auth system design.
   */
  private checkApplicationEdorgsForUnsafeOperations(
    application: Pick<GetApplicationDtoV3, 'educationOrganizationIds' | 'dataStoreIds'>,
    validIds: Ids,
  ) {
    return application.dataStoreIds.every((dataStoreId) =>
      application.educationOrganizationIds.every((edorgId) =>
        checkId(
          edorgKeyV2({
            edorg: edorgId,
            ods: dataStoreId,
          }),
          validIds,
        ),
      ),
    );
  }

  //
  // Vendors
  //

  @Get('vendors')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.vendor:read',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async getVendors(
    // TODO including these unused parameters is necessary for NestJS's Open API spec generation, which uses metadata configured by the parameter decorators.
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @InjectFilter('team.sb-environment.edfi-tenant.vendor:read') validIds: Ids,
  ) {
    const allVendors = await this.sbService.getVendors(edfiTenant);
    return allVendors.filter((v) => checkId(v.id, validIds));
  }

  @Get('vendors/:vendorId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.vendor:read',
    subject: {
      id: 'vendorId',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async getVendor(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('vendorId', new ParseIntPipe()) vendorId: number,
  ) {
    return this.sbService.getVendor(edfiTenant, vendorId);
  }

  @Put('vendors/:vendorId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.vendor:update',
    subject: {
      id: 'vendorId',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async putVendor(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('vendorId', new ParseIntPipe()) vendorId: number,
    @Body() vendor: PutVendorDtoV3,
  ) {
    return this.sbService.putVendor(edfiTenant, vendorId, vendor);
  }

  @Post('vendors')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.vendor:create',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async postVendor(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Body() vendor: PostVendorDtoV3,
  ) {
    return this.sbService.postVendor(edfiTenant, vendor);
  }

  @Delete('vendors/:vendorId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.vendor:delete',
    subject: {
      id: 'vendorId',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async deleteVendor(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('vendorId', new ParseIntPipe()) vendorId: number,
  ) {
    return this.sbService.deleteVendor(edfiTenant, vendorId);
  }

  //
  // Applications
  //

  @Get('applications')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:read',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async getApplications(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @InjectFilter('team.sb-environment.edfi-tenant.ods.edorg.application:read')
    validIds: Ids,
  ) {
    const allApplications = await this.sbService.getApplications(edfiTenant);

    const integrationProviderApps = await this.integrationAppsTeamService.findAll({
      edfiTenantId,
    });
    const idToAppsMap = new Map<number, GetIntegrationAppDto>();
    integrationProviderApps.forEach((app) => idToAppsMap.set(app.applicationId, app));

    return allApplications
      .filter((application) => this.checkApplicationEdorgsForSafeOperations(application, validIds))
      .map((application) => ({
        // The EdFi application overrides any differences with the Integration App
        ...idToAppsMap.get(application.id),
        ...application,
        id: application.id,
      })) as (GetApplicationDtoV3 & GetIntegrationAppDto)[];
  }

  @Get('applications/:applicationId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:read',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async getApplication(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('applicationId', new ParseIntPipe()) applicationId: number,
    @InjectFilter('team.sb-environment.edfi-tenant.ods.edorg.application:read')
    validIds: Ids,
  ) {
    const application = await this.sbService.getApplication(edfiTenant, applicationId);

    if (this.checkApplicationEdorgsForSafeOperations(application, validIds)) {
      try {
        const integrationProviderApp = await this.integrationAppsTeamService.findOne({
          applicationId,
          edfiTenantId,
        });
        return {
          // The EdFi application overrides any differences with the Integration App
          ...integrationProviderApp,
          ...application,
          id: application.id,
        };
      } catch (_error) {
        return application;
      }
    } else {
      throw new NotFoundException();
    }
  }

  @Put('applications/:applicationId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:update',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async putApplication(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('applicationId', new ParseIntPipe()) applicationId: number,
    @Body() application: PutApplicationFormDtoV3,
    @InjectFilter('team.sb-environment.edfi-tenant.ods.edorg.application:update')
    validIds: Ids,
  ) {
    let claimset: GetClaimsetSingleDtoV3;
    try {
      claimset = await this.sbService.getClaimset(edfiTenant, application.claimsetId);
    } catch (_claimsetNotFound) {
      throw new ValidationHttpException({
        field: 'claimsetId',
        message: 'Cannot retrieve claimset for validation',
      });
    }
    if (claimset._isSystemReserved) {
      throw new ValidationHttpException({
        field: 'claimsetId',
        message: 'Cannot use system-reserved claimset',
      });
    }
    const availableEdorgs = await this.edorgRepository.findBy({
      edfiTenantId: edfiTenant.id,
      educationOrganizationId: In(application.educationOrganizationIds),
      odsInstanceId: application.dataStoreId,
    });
    const odsInstanceId = availableEdorgs[0].odsInstanceId;

    // This checks the existing unchanged version of the application against the valid IDs
    const existingApplication = await this.sbService.getApplication(edfiTenant, applicationId);
    if (!this.checkApplicationEdorgsForUnsafeOperations(existingApplication, validIds)) {
      throw new HttpException('You do not have control of all implicated Ed-Orgs', 403);
    }

    const dto = plainToInstance(PutApplicationDtoV3, {
      ...instanceToPlain(application),
      claimSetName: claimset.name,
      dataStoreIds: [odsInstanceId],
      educationOrganizationIds: availableEdorgs.map((edorg) => edorg.educationOrganizationId),
    });

    if (dto.educationOrganizationIds.length !== availableEdorgs.length) {
      throw new ValidationHttpException({
        field: 'edorgIds',
        message: 'One or more invalid education organization IDs',
      });
    }
    if (
      !availableEdorgs.every((edorg) => edorg.odsInstanceId === availableEdorgs[0].odsInstanceId)
    ) {
      throw new ValidationHttpException({
        field: 'edorgIds',
        message: 'Education organizations not all from the same ODS',
      });
    }

    // This checks the new version of the application against the valid IDs
    if (this.checkApplicationEdorgsForUnsafeOperations(dto, validIds)) {
      const realOds = await this.odsRepository.findOneBy({
        edfiTenantId: edfiTenant.id,
        odsInstanceId,
      });
      const existingIntegrationApp = await this.integrationAppsTeamService.findOne({
        applicationId,
        edfiTenantId,
      });

      if (existingIntegrationApp) {
        // EdFi applications that are Integration Apps are only allowed to update: name, vendor, profile, and claimset
        if (realOds.id !== existingIntegrationApp.odsId) {
          throw new ValidationHttpException({
            field: 'dataStoreId',
            message: 'Cannot change ODS instance for an Integration Application',
          });
        }
        if (dto.integrationProviderId !== existingIntegrationApp.integrationProviderId) {
          throw new ValidationHttpException({
            field: 'integrationProviderId',
            message: 'Cannot change Integration Provider for an Integration Application',
          });
        }

        const realEdorgs = await this.edorgRepository.findBy({
          edfiTenantId: edfiTenant.id,
          educationOrganizationId: In(dto.educationOrganizationIds),
          odsInstanceId,
        });
        const hasChangedAmountOfEdorgs =
          realEdorgs.length !== existingIntegrationApp.edorgIds.length;
        const hasChangedEdorgs = realEdorgs.some(
          (edorg) => !existingIntegrationApp.edorgIds.includes(edorg.id),
        );
        if (hasChangedAmountOfEdorgs || hasChangedEdorgs) {
          throw new ValidationHttpException({
            field: 'educationOrganizationIds',
            message: 'Cannot change Education Organization IDs for an Integration Application',
          });
        }

        // Integration Apps are only allowed to change their name so only update if the name changes
        const hasNewName = dto.applicationName !== existingIntegrationApp.applicationName;
        if (hasNewName) {
          await this.integrationAppsTeamService.update({
            applicationId,
            edfiTenantId,
            applicationName: dto.applicationName,
          });
        }
      }

      // If no Integration App exists and an integrationProviderId is provided, create a new Integration App
      if (!existingIntegrationApp && dto.integrationProviderId) {
        await this.integrationAppsTeamService.create({
          applicationId,
          applicationName: dto.applicationName,
          edfiTenantId: edfiTenant.id,
          edorgIds: availableEdorgs.map((edorg) => edorg.id),
          integrationProviderId: dto.integrationProviderId,
          odsId: realOds.id,
          sbEnvironmentId: edfiTenant.sbEnvironmentId,
        });
      }

      delete dto.integrationProviderId;
      return this.sbService.putApplication(edfiTenant, applicationId, dto);
    } else {
      throw new ValidationHttpException({
        field: 'edorgIds',
        message: 'Not authorized on all education organizations',
      });
    }
  }

  @Post('applications')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:create',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async postApplication(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @ReqSbEnvironment() sbEnvironment: SbEnvironment,
    @Query('returnRaw') returnRaw: boolean | undefined,
    @Body() application: PostApplicationFormDtoV3,
    @InjectFilter('team.sb-environment.edfi-tenant.ods.edorg.application:create')
    validIds: Ids,
  ) {
    let claimset: GetClaimsetSingleDtoV3;
    try {
      claimset = await this.sbService.getClaimset(edfiTenant, application.claimsetId);
    } catch (claimsetNotFound) {
      Logger.error(claimsetNotFound);
      throw new BadRequestException('Error trying to use claimset');
    }
    if (claimset._isSystemReserved) {
      throw new ValidationHttpException({
        field: 'claimsetId',
        message: 'Cannot use system-reserved claimset',
      });
    }

    const { educationOrganizationIds, dataStoreId } = application;
    const realEdorgs = await this.edorgRepository.findBy({
      edfiTenantId: edfiTenant.id,
      educationOrganizationId: In(educationOrganizationIds),
      odsInstanceId: dataStoreId,
    });
    if (realEdorgs.length !== educationOrganizationIds.length) {
      throw new ValidationHttpException({
        field: 'educationOrganizationIds',
        message: 'Invalid education organization IDs',
      });
    }

    const dto = plainToInstance(
      PostApplicationDtoV3,
      {
        ...instanceToPlain(application),
        claimSetName: claimset.name,
        dataStoreIds: [dataStoreId],
      },
      { excludeExtraneousValues: true },
    );

    if (!sbEnvironment.domain)
      throw new InternalServerErrorException('Environment config lacks an Ed-Fi hostname.');
    if (this.checkApplicationEdorgsForUnsafeOperations(dto, validIds)) {
      const adminApiResponse = await this.sbService.postApplication(edfiTenant, dto);

      if (application.integrationProviderId) {
        const realOds = await this.odsRepository.findOneBy({
          edfiTenantId: edfiTenant.id,
          odsInstanceId: dataStoreId,
        });
        await this.integrationAppsTeamService.create({
          applicationId: adminApiResponse.id,
          applicationName: application.applicationName,
          edfiTenantId: edfiTenant.id,
          edorgIds: realEdorgs.map((edorg) => edorg.id),
          integrationProviderId: application.integrationProviderId,
          odsId: realOds.id,
          sbEnvironmentId: sbEnvironment.id,
        });
      }
      if (asBool(config.USE_YOPASS)) {
        try {
          const yopassResult = await postYopassSecret({
            ...adminApiResponse,
            url: GetApplicationDtoV3.apiUrl(
              sbEnvironment.startingBlocks,
              sbEnvironment.domain,
              application.applicationName,
              edfiTenant.name,
            ),
          });

          return toApplicationYopassResponseDto({
            link: yopassResult.link,
            applicationId: adminApiResponse.id,
            secretSharingMethod: SecretSharingMethod.Yopass,
          });
        } catch (error) {
          Logger.error('Yopass failed for postApplication:', error);
          throw error; // Re-throw the original error
        }
      } else {
        return toPostApplicationResponseDtoV3({
          ...adminApiResponse,
          secretSharingMethod: SecretSharingMethod.Direct,
        });
      }
    } else {
      throw new ValidationHttpException({
        field: 'educationOrganizationId',
        message: 'Invalid education organization ID',
      });
    }
  }

  @Delete('applications/:applicationId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:delete',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async deleteApplication(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('applicationId', new ParseIntPipe()) applicationId: number,
    @InjectFilter('team.sb-environment.edfi-tenant.ods.edorg.application:delete')
    validIds: Ids,
  ) {
    const application = await this.sbService.getApplication(edfiTenant, applicationId);

    if (this.checkApplicationEdorgsForUnsafeOperations(application, validIds)) {
      this.integrationAppsTeamService.remove({ applicationId, edfiTenantId });
      return this.sbService.deleteApplication(edfiTenant, applicationId);
    } else {
      throw new HttpException('You do not have control of all implicated Ed-Orgs', 403);
    }
  }

  //
  // Api Clients
  //

  @Get('apiclients')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:read',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async getApiClients(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @InjectFilter('team.sb-environment.edfi-tenant.ods.edorg.application:read') validIds: Ids,
    @Query('applicationId') applicationId?: number,
  ) {
    if (applicationId === undefined) {
      throw new BadRequestException('Query parameter "applicationId" is required.');
    }

    const allApiClients = await this.sbService.getApiClients(edfiTenant, applicationId);
    return allApiClients.filter((v) => checkId(v.id, validIds));
  }

  @Get('apiclients/:apiclientId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:read',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async getApiClient(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('apiclientId', new ParseIntPipe()) apiClientId: number,
    @InjectFilter('team.sb-environment.edfi-tenant.ods.edorg.application:read')
    validIds: Ids,
  ) {
    if (!checkId(apiClientId, validIds)) {
      throw new NotFoundException();
    }
    return await this.sbService.getApiClient(edfiTenant, apiClientId);
  }

  @Put('apiclients/:apiclientId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:update',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async putApiClient(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('apiclientId', new ParseIntPipe()) apiClientId: number,
    @Body() apiClient: PutApiClientDtoV3,
    @InjectFilter('team.sb-environment.edfi-tenant.ods.edorg.application:update')
    validIds: Ids,
  ) {
    if (!checkId(apiClientId, validIds)) {
      throw new NotFoundException();
    }

    const existingApiClient = await this.sbService.getApiClient(edfiTenant, apiClientId);
    if (existingApiClient && existingApiClient.applicationId !== apiClient.applicationId) {
      throw new BadRequestException(
        'The applicationId in the request body must match the existing API client applicationId.',
      );
    }

    return await this.sbService.putApiClient(edfiTenant, apiClientId, apiClient);
  }

  @Post('apiclients')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:update',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async postApiClient(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @ReqSbEnvironment() sbEnvironment: SbEnvironment,
    @Body() apiClient: PostApiClientDtoV3,
    @InjectFilter('team.sb-environment.edfi-tenant.ods.edorg.application:update')
    validIds: Ids,
  ) {
    const application = await this.sbService.getApplication(edfiTenant, apiClient.applicationId);
    if (!this.checkApplicationEdorgsForUnsafeOperations(application, validIds)) {
      throw new HttpException('You do not have control of all implicated Ed-Orgs', 403);
    }

    const adminApiResponse = await this.sbService.postApiClient(edfiTenant, apiClient);

    if (asBool(config.USE_YOPASS)) {
      try {
        const yopassResult = await postYopassSecret({
          ...adminApiResponse,
          url: GetApiClientDtoV3.apiUrl(
            sbEnvironment.startingBlocks,
            sbEnvironment.domain,
            apiClient.name,
            edfiTenant.name,
          ),
        });

        return toApiClientYopassResponseDto({
          link: yopassResult.link,
          apiClientId: adminApiResponse.id,
          secretSharingMethod: SecretSharingMethod.Yopass,
        });
      } catch (error) {
        Logger.error('Yopass failed for postApiClient:', error);
        throw error;
      }
    } else {
      return toPostApiClientResponseDtoV3({
        ...adminApiResponse,
        secretSharingMethod: SecretSharingMethod.Direct,
      });
    }
  }

  @Put('apiclients/:apiclientId/reset-credential')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:reset-credentials',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async resetApiClientCredentials(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @ReqSbEnvironment() sbEnvironment: SbEnvironment,
    @Param('apiclientId', new ParseIntPipe()) apiClientId: number,
    @InjectFilter('team.sb-environment.edfi-tenant.ods.edorg.application:reset-credentials')
    validIds: Ids,
  ) {
    const apiClient = await this.sbService.getApiClient(edfiTenant, apiClientId);
    const application = await this.sbService.getApplication(edfiTenant, apiClient.applicationId);

    if (!this.checkApplicationEdorgsForUnsafeOperations(application, validIds)) {
      throw new HttpException('You do not have control of all implicated Ed-Orgs', 403);
    }

    const adminApiResponse = await this.sbService.putApiClientResetCredential(
      edfiTenant,
      apiClientId,
    );

    if (asBool(config.USE_YOPASS)) {
      try {
        const yopassResult = await postYopassSecret({
          ...adminApiResponse,
          url: GetApiClientDtoV3.apiUrl(
            sbEnvironment.startingBlocks,
            sbEnvironment.domain,
            application.applicationName,
            edfiTenant.name,
          ),
        });

        return toApiClientYopassResponseDto({
          link: yopassResult.link,
          apiClientId: adminApiResponse.id,
          secretSharingMethod: SecretSharingMethod.Yopass,
        });
      } catch (error) {
        Logger.error('Yopass failed for resetApiClientCredentials:', error);
        throw error;
      }
    } else {
      return toPostApiClientResponseDtoV3({
        ...adminApiResponse,
        secretSharingMethod: SecretSharingMethod.Direct,
      });
    }
  }

  @Delete('apiclients/:apiclientId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:delete',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async deleteApiClient(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('apiclientId', new ParseIntPipe()) apiClientId: number,
    @InjectFilter('team.sb-environment.edfi-tenant.ods.edorg.application:delete')
    validIds: Ids,
  ) {
    const apiClient = await this.sbService.getApiClient(edfiTenant, apiClientId);
    const application = await this.sbService.getApplication(edfiTenant, apiClient.applicationId);

    if (!this.checkApplicationEdorgsForUnsafeOperations(application, validIds)) {
      throw new HttpException('You do not have control of all implicated Ed-Orgs', 403);
    }

    return await this.sbService.deleteApiClient(edfiTenant, apiClientId);
  }

  //
  // Claimsets
  //

  @Get('claimsets')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.claimset:read',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async getClaimsets(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @InjectFilter('team.sb-environment.edfi-tenant.claimset:read')
    validIds: Ids,
  ) {
    const allClaimsets = await this.sbService.getClaimsets(edfiTenant);
    return allClaimsets.filter((c) => checkId(c.id, validIds));
  }
  @Post('claimsets/export')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.claimset:read',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async exportClaimset(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Query('id') _ids: string[] | string,
    @InjectFilter('team.sb-environment.edfi-tenant.claimset:read') validIds: Ids,
  ) {
    const ids = Array.isArray(_ids) ? _ids : _ids === undefined || _ids === '' ? [] : [_ids];
    if (ids.length === 0)
      throw new BadRequestException('At least one claimset ID must be provided');
    const parsedIds = ids.map((id) => {
      const trimmed = id.trim();
      const n = parseInt(trimmed, 10);
      if (isNaN(n) || n <= 0 || n.toString() !== trimmed)
        throw new BadRequestException(`Invalid claimset ID: ${id}`);
      return n;
    });
    for (const id of parsedIds) {
      if (!checkId(id, validIds))
        throw new ForbiddenException(`Access denied to claimset ID: ${id}`);
    }
    const claimsets = await Promise.all(
      parsedIds.map((id) => this.sbService.exportClaimset(edfiTenant, id)),
    );
    const title =
      claimsets.length === 1 ? claimsets[0].name : `${edfiTenant.sbEnvironment.envLabel} claimsets`;
    const document = {
      title,
      template: {
        claimSets: claimsets.map((c) => ({
          name: c.name,
          resourceClaims: c.resourceClaims,
        })),
      },
    };
    const id = Math.round(Math.random() * 999999999999);
    this.downloadCache.set(id, {
      content: JSON.stringify(document, null, 2),
      title: `${title.replace(/[/\\:*?"<>|]+/g, '_')}_${Number(new Date())}.json`,
    });
    return new Id(id);
  }
  @Get('claimsets/export/:exportId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.claimset:read',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async downloadExportClaimset(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @Param('exportId', new ParseIntPipe()) exportId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Res() res: Response,
  ) {
    const cachedItem = this.downloadCache.get<{ content: string; title: string }>(Number(exportId));
    this.downloadCache.del(Number(exportId));
    if (cachedItem === undefined) {
      throw new NotFoundException(
        'Export not found. It may have expired. We hold on to exports for 5 minutes after creation.',
      );
    } else {
      const { content, title } = cachedItem;
      res.setHeader('Content-Disposition', `attachment; filename=${title}`);
      res.setHeader('Content-Type', 'application/json');
      res.send(content);
    }
  }
  @Get('claimsets/:claimsetId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.claimset:read',
    subject: {
      id: 'claimsetId',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async getClaimset(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('claimsetId', new ParseIntPipe()) claimsetId: number,
  ) {
    return this.sbService.getClaimset(edfiTenant, claimsetId);
  }

  @Put('claimsets/:claimsetId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.claimset:update',
    subject: {
      id: 'claimsetId',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async putClaimset(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('claimsetId', new ParseIntPipe()) claimsetId: number,
    @Body() claimset: PutClaimsetDtoV3,
  ) {
    return await this.sbService.putClaimset(edfiTenant, claimsetId, claimset);
  }

  @Post('claimsets')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.claimset:create',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async postClaimset(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Body() claimset: PostClaimsetDtoV3,
  ) {
    return await this.sbService.postClaimset(edfiTenant, claimset);
  }
  @Post('claimsets/copy')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.claimset:create',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async copyClaimset(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Body() claimset: CopyClaimsetDtoV3,
  ) {
    try {
      return await this.sbService.copyClaimset(edfiTenant, claimset);
    } catch (PostError: unknown) {
      Logger.error(
         'Admin API copyClaimset failed: ' +
           (axios.isAxiosError(PostError)
             ? PostError.message +
               ' (status ' +
               (PostError.response?.status ?? 'unknown') +
               ')'
             : String(PostError))
       );
      if (axios.isAxiosError(PostError)) {
        if (isIAdminApiValidationError(PostError.response?.data)) {
          if (PostError.response.data.errors?.Name?.[0]?.includes('this name already exists')) {
            throw new ValidationHttpException({
              field: 'name',
              message: 'A claimset with this name already exists. Please choose a different name.',
            });
          } else {
            throw new CustomHttpException(
              {
                title: 'Validation error',
                type: 'Error',
                data: PostError.response.data,
              },
              400,
            );
          }
        }
      }
      throw PostError;
    }
  }
  @Post('claimsets/import')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.claimset:create',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async importClaimset(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Body() claimset: ImportClaimsetSingleDtoV3,
  ) {
    return this.sbService.importClaimset(edfiTenant, claimset);
  }

  @Delete('claimsets/:claimsetId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.claimset:delete',
    subject: {
      id: 'claimsetId',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async deleteClaimset(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('claimsetId', new ParseIntPipe()) claimsetId: number,
  ) {
    await this.sbService.deleteClaimset(edfiTenant, claimsetId);
    return undefined;
  }

  //
  // Data Stores (renamed from V2's "Ods Instances")
  //

  @Get('dataStores')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods:read',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async getDataStores(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @InjectFilter('team.sb-environment.edfi-tenant.ods:read')
    validIds: Ids,
  ) {
    const allDataStores = await this.sbService.getDataStores(edfiTenant);
    return allDataStores.filter((c) => checkId(c.id, validIds));
  }

  @Post('instances')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant:create-ods',
    subject: { id: '__filtered__', edfiTenantId: 'edfiTenantId', teamId: 'teamId' },
  })
  async postInstance(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Body() instance: PostInstanceDtoV3,
  ) {
    try {
      const createdInstance = await this.sbService.postInstance(edfiTenant, instance);
      const createdOds = await this.odsRepository.save({
        edfiTenantId: edfiTenant.id,
        sbEnvironmentId: edfiTenant.sbEnvironmentId,
        odsInstanceId: createdInstance.id,
        dbName: instance.name,
        odsInstanceName: instance.name,
        instanceType: instance.databaseTemplate,
        databaseTemplate: instance.databaseTemplate,
        status: 'PendingCreate',
      });

      await this.jobQueue.send(
        ENV_SYNC_CHNL,
        { sbEnvironmentId: edfiTenant.sbEnvironmentId },
        { expireInHours: 2 },
      );

      return { id: createdOds.id };
    } catch (PostError: unknown) {
      Logger.error(
        'Admin API postInstance failed: ' +
          (axios.isAxiosError(PostError)
            ? PostError.message + ' (status ' + (PostError.response?.status ?? 'unknown') + ')'
            : String(PostError)),
      );
      if (
        axios.isAxiosError(PostError) &&
        isIAdminApiValidationError(PostError.response?.data) &&
        Object.keys(PostError.response.data.errors).length > 0
      ) {
        const [apiField, apiMessages] = Object.entries(PostError.response.data.errors)[0];
        const apiMessage = apiMessages[0];
        if (apiField.toLowerCase() === 'name') {
          throw new ValidationHttpException({ field: 'name', message: apiMessage });
        }
        if (apiField.toLowerCase() === 'databasetemplate') {
          throw new ValidationHttpException({ field: 'databaseTemplate', message: apiMessage });
        }
        throw new CustomHttpException(
          { title: 'Validation error', type: 'Error', data: PostError.response.data },
          400,
        );
      }
      throw PostError;
    }
  }

  @Delete('instances/:instanceManageId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant:delete-ods',
    subject: { id: 'instanceManageId', edfiTenantId: 'edfiTenantId', teamId: 'teamId' },
  })
  async deleteInstance(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('instanceManageId', new ParseIntPipe()) instanceManageId: number,
  ) {
    if (instanceManageId <= 0) {
      throw new BadRequestException('instanceManageId must be greater than zero');
    }

    const localOds = await this.odsRepository.findOneBy({
      edfiTenantId: edfiTenant.id,
      instanceManageId,
    });

    if (!localOds) {
      throw new NotFoundException('ODS not found for instanceManageId');
    }

    if (localOds.status !== 'Created') {
      throw new BadRequestException("ODS must be in 'Created' status to delete by instanceManageId");
    }

    await this.sbService.deleteInstance(edfiTenant, instanceManageId);

    await this.odsRepository.save({ ...localOds, status: 'PendingDelete' });

    await this.jobQueue.send(
      ENV_SYNC_CHNL,
      { sbEnvironmentId: edfiTenant.sbEnvironmentId },
      { expireInHours: 2 },
    );

    return undefined;
  }

  //
  // Profiles
  //

  @Get('profiles')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.profile:read',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async getProfiles(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @InjectFilter('team.sb-environment.edfi-tenant.profile:read')
    validIds: Ids,
  ) {
    const allProfiles = await this.sbService.getProfiles(edfiTenant);
    return allProfiles.filter((c) => checkId(c.id, validIds));
  }

  @Get('profiles/:profileId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.profile:read',
    subject: {
      id: 'profileId',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async getProfile(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('profileId', new ParseIntPipe()) profileId: number,
  ) {
    return this.sbService.getProfile(edfiTenant, profileId);
  }

  @Put('profiles/:profileId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.profile:update',
    subject: {
      id: 'profileId',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async putProfile(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('profileId', new ParseIntPipe()) profileId: number,
    @Body() profile: PutProfileDtoV3,
  ) {
    {
      try {
        return await this.sbService.putProfile(edfiTenant, profileId, profile);
      } catch (error) {
        if (error.response.data.title === 'Validation failed') {
          const errorDefiniton = error.response.data.errors['Definition'][0];
          throw new HttpException(`Invalid XML format for definition: ${errorDefiniton}`, 500);
        } else {
          throw new HttpException('Error updating profile', 500);
        }
      }
    }
  }

  @Post('profiles')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.profile:create',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async postProfile(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Body() profile: PostProfileDtoV3,
  ) {
    try {
      return await this.sbService.postProfile(edfiTenant, profile);
    } catch (PostError: unknown) {
      Logger.error(
         'Admin API postProfile failed: ' +
           (axios.isAxiosError(PostError)
             ? PostError.message +
               ' (status ' +
               (PostError.response?.status ?? 'unknown') +
               ')'
             : String(PostError))
       );
      if (axios.isAxiosError(PostError)) {
        if (isIAdminApiValidationError(PostError.response?.data)) {
          if (PostError.response.data.errors?.Name?.[0]?.includes('this name already exists')) {
            throw new ValidationHttpException({
              field: 'name',
              message: 'A profile with this name already exists. Please choose a different name.',
            });
          } else if (PostError.response.data.errors?.Definition?.[0]?.includes('List of possible elements expected:')) {
            const errorDefinition = PostError.response.data.errors['Definition'][0];
            throw new ValidationHttpException(
              {
                field: 'definition',
                message: `Invalid XML format for definition: ${errorDefinition}`,
              }
            );
          } else {
            throw new CustomHttpException(
              {
                title: 'Validation error',
                type: 'Error',
                data: PostError.response.data,
              },
              400
            );
          }
        }
      }
      throw PostError;
    }
  }

  @Delete('profiles/:profileId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.profile:delete',
    subject: {
      id: 'profileId',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async deleteProfile(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('profileId', new ParseIntPipe()) profileId: number,
  ) {
    await this.sbService.deleteProfile(edfiTenant, profileId);
    return undefined;
  }
}
