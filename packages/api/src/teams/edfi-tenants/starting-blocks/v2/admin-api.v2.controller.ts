import {
  CopyClaimsetDtoV2,
  GetApplicationDtoV2,
  GetClaimsetSingleDtoV2,
  GetIntegrationAppDto,
  Id,
  Ids,
  ImportClaimsetSingleDtoV2,
  PostApplicationDtoV2,
  PostApplicationFormDtoV2,
  PutApiClientDtoV2,
  PostClaimsetDtoV2,
  PostProfileDtoV2,
  PostVendorDtoV2,
  PutApplicationDtoV2,
  PutApplicationFormDtoV2,
  PutClaimsetDtoV2,
  PutProfileDtoV2,
  PutVendorDtoV2,
  SecretSharingMethod,
  edorgKeyV2,
  toApplicationYopassResponseDto,
  toPostApplicationResponseDto,
  toPostApplicationResponseDtoV2,
} from '@edanalytics/models';
import { EdfiTenant, Edorg, Ods, SbEnvironment } from '@edanalytics/models-server';
import {
  BadRequestException,
  Body,
  CallHandler,
  Controller,
  Delete,
  ExecutionContext,
  Get,
  HttpException,
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
  isIAdminApiValidationError,
  postYopassSecret,
} from '../../../../utils';
import { AdminApiV1xExceptionFilter } from '../v1/admin-api-v1x-exception.filter';
import { AdminApiServiceV2 } from './admin-api.v2.service';
import { IntegrationAppsTeamService } from '../../../../integration-apps-team/integration-apps-team.service';
import config from 'config';

@Injectable()
class AdminApiV2Interceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const configPublic = request.sbEnvironment.configPublic;
    if (!('version' in configPublic && configPublic.version === 'v2')) {
      throw new NotFoundException(
        `Requested Admin API version not correct for this EdfiTenant. Use "${request.sbEnvironment.configPublic.adminApiVersion}" instead.`
      );
    }
    return next.handle();
  }
}

@UseFilters(new AdminApiV1xExceptionFilter())
@UseInterceptors(SbEnvironmentEdfiTenantInterceptor, AdminApiV2Interceptor)
@ApiTags('Admin API Resources - v2.x')
@Controller()
export class AdminApiControllerV2 {
  private downloadCache = new NodeCache({ stdTTL: 60 * 5 /* 5 minutes */ });
  constructor(
    private readonly integrationAppsTeamService: IntegrationAppsTeamService,
    private readonly sbService: AdminApiServiceV2,
    @InjectRepository(Edorg) private readonly edorgRepository: Repository<Edorg>,
    @InjectRepository(Ods) private readonly odsRepository: Repository<Ods>
  ) { }

  /** Check application edorg IDs against auth cache for _safe_ operations (GET). Requires `some` ID to be authorized. */
  private checkApplicationEdorgsForSafeOperations(
    application: Pick<GetApplicationDtoV2, 'educationOrganizationIds' | 'odsInstanceIds'>,
    validIds: Ids
  ) {
    return application.odsInstanceIds.some((odsInstanceId) =>
      application.educationOrganizationIds.some((edorgId) =>
        checkId(
          edorgKeyV2({
            edorg: edorgId,
            ods: odsInstanceId,
          }),
          validIds
        )
      )
    );
  }

  /** Check application edorg IDs against auth cache for _unsafe_ operations (POST/PUT/DELETE). Requires `every` ID to be authorized.
   * Note that IDs which don't exist in SBAA &mdash; either because they haven't synced yet or because they don't exist in EdFi &mdash; can
   * never be authorized via an Edorg or Ods ownership, but _can_ be via an EdfiTenant or SbEnvironment ownership. This is due to some
   * quirks in the SBAA auth system design.
   */
  private checkApplicationEdorgsForUnsafeOperations(
    application: Pick<GetApplicationDtoV2, 'educationOrganizationIds' | 'odsInstanceIds'>,
    validIds: Ids
  ) {
    return application.odsInstanceIds.every((odsInstanceId) =>
      application.educationOrganizationIds.every((edorgId) =>
        checkId(
          edorgKeyV2({
            edorg: edorgId,
            ods: odsInstanceId,
          }),
          validIds
        )
      )
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
    @InjectFilter('team.sb-environment.edfi-tenant.vendor:read') validIds: Ids
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
    @Param('vendorId', new ParseIntPipe()) vendorId: number
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
    @Body() vendor: PutVendorDtoV2
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
    @Body() vendor: PostVendorDtoV2
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
    @Param('vendorId', new ParseIntPipe()) vendorId: number
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
    validIds: Ids
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
      })) as (GetApplicationDtoV2 & GetIntegrationAppDto)[];
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
    validIds: Ids
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
      } catch (error) {
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
    @Body() application: PutApplicationFormDtoV2,
    @InjectFilter('team.sb-environment.edfi-tenant.ods.edorg.application:update')
    validIds: Ids
  ) {
    let claimset: GetClaimsetSingleDtoV2;
    try {
      claimset = await this.sbService.getClaimset(edfiTenant, application.claimsetId);
    } catch (claimsetNotFound) {
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
      odsInstanceId: application.odsInstanceId,
    });
    const odsInstanceId = availableEdorgs[0].odsInstanceId;

    // This checks the existing unchanged version of the application against the valid IDs
    const existingApplication = await this.sbService.getApplication(edfiTenant, applicationId);
    if (!this.checkApplicationEdorgsForUnsafeOperations(existingApplication, validIds)) {
      throw new HttpException('You do not have control of all implicated Ed-Orgs', 403);
    }

    const dto = plainToInstance(PutApplicationDtoV2, {
      ...instanceToPlain(application),
      claimSetName: claimset.name,
      odsInstanceIds: [odsInstanceId],
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
            field: 'odsInstanceId',
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
          (edorg) => !existingIntegrationApp.edorgIds.includes(edorg.id)
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
    @Body() application: PostApplicationFormDtoV2,
    @InjectFilter('team.sb-environment.edfi-tenant.ods.edorg.application:create')
    validIds: Ids
  ) {
    let claimset: GetClaimsetSingleDtoV2;
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

    const { educationOrganizationIds, odsInstanceId } = application;
    const realEdorgs = await this.edorgRepository.findBy({
      edfiTenantId: edfiTenant.id,
      educationOrganizationId: In(educationOrganizationIds),
      odsInstanceId,
    });
    if (realEdorgs.length !== educationOrganizationIds.length) {
      throw new ValidationHttpException({
        field: 'educationOrganizationIds',
        message: 'Invalid education organization IDs',
      });
    }

    const dto = plainToInstance(
      PostApplicationDtoV2,
      {
        ...instanceToPlain(application),
        claimSetName: claimset.name,
        odsInstanceIds: [odsInstanceId],
      },
      { excludeExtraneousValues: true }
    );

    if (!sbEnvironment.domain)
      throw new InternalServerErrorException('Environment config lacks an Ed-Fi hostname.');
    if (this.checkApplicationEdorgsForUnsafeOperations(dto, validIds)) {
      const adminApiResponse = await this.sbService.postApplication(edfiTenant, dto);

      if (application.integrationProviderId) {
        const realOds = await this.odsRepository.findOneBy({
          edfiTenantId: edfiTenant.id,
          odsInstanceId,
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
      if (config.USE_YOPASS) {
        try {
          const yopassResult = await postYopassSecret({
            ...adminApiResponse,
            url: GetApplicationDtoV2.apiUrl(
              sbEnvironment.startingBlocks,
              sbEnvironment.domain,
              application.applicationName,
              edfiTenant.name
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
        return toPostApplicationResponseDtoV2({
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
    validIds: Ids
  ) {
    const application = await this.sbService.getApplication(edfiTenant, applicationId);

    if (this.checkApplicationEdorgsForUnsafeOperations(application, validIds)) {
      this.integrationAppsTeamService.remove({ applicationId, edfiTenantId });
      return this.sbService.deleteApplication(edfiTenant, applicationId);
    } else {
      throw new HttpException('You do not have control of all implicated Ed-Orgs', 403);
    }
  }

  @Put('applications/:applicationId/reset-credential')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:reset-credentials',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async resetApplicationCredentials(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @ReqSbEnvironment() sbEnvironment: SbEnvironment,
    @Param('applicationId', new ParseIntPipe()) applicationId: number,
    @InjectFilter('team.sb-environment.edfi-tenant.ods.edorg.application:reset-credentials')
    validIds: Ids
  ) {
    const application = await this.sbService.getApplication(edfiTenant, applicationId);

    if (this.checkApplicationEdorgsForUnsafeOperations(application, validIds)) {
      const integrationProviderApp = await this.integrationAppsTeamService.findOne({
        applicationId,
        edfiTenantId,
      });
      if (integrationProviderApp) {
        throw new CustomHttpException(
          {
            title: 'Cannot reset credentials for an Integration Provider application.',
            type: 'Error',
          },
          400
        );
      }

      const adminApiResponse = await this.sbService.putApplicationResetCredential(
        edfiTenant,
        applicationId
      );

      if (config.USE_YOPASS) {
        try {
          const yopassResult = await postYopassSecret({
            ...adminApiResponse,
            url: GetApplicationDtoV2.apiUrl(
              sbEnvironment.startingBlocks,
              sbEnvironment.domain,
              application.applicationName,
              edfiTenant.name
            ),
          });

          return toApplicationYopassResponseDto({
            link: yopassResult.link,
            applicationId: adminApiResponse.id,
            secretSharingMethod: SecretSharingMethod.Yopass,
          });
        } catch (error) {
          Logger.error('Yopass failed for resetApplicationCredentials:', error);
          throw error; // Re-throw the original error
        }
      } else {
        return toPostApplicationResponseDtoV2({
          ...adminApiResponse,
          secretSharingMethod: SecretSharingMethod.Direct,
        });
      }
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
    validIds: Ids
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
    @Body() apiClient: PutApiClientDtoV2,
    @InjectFilter('team.sb-environment.edfi-tenant.ods.edorg.application:update')
    validIds: Ids
  ) {
    if (!checkId(apiClientId, validIds)) {
      throw new NotFoundException();
    }

    const existingApiClient = await this.sbService.getApiClient(edfiTenant, apiClientId);
    if (
      existingApiClient &&
      existingApiClient.applicationId !== apiClient.applicationId
    ) {
      throw new BadRequestException(
        'The applicationId in the request body must match the existing API client applicationId.'
      );
    }

    return await this.sbService.putApiClient(edfiTenant, apiClientId, apiClient);
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
    validIds: Ids
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
    @Query('id') _ids: string[] | string
  ) {
    const ids = Array.isArray(_ids) ? _ids : [_ids];
    const claimsets = await Promise.all(
      ids.map((id) => this.sbService.exportClaimset(edfiTenant, Number(id)))
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
    @Res() res: Response
  ) {
    const cachedItem = this.downloadCache.get<{ content: string; title: string }>(Number(exportId));
    this.downloadCache.del(Number(exportId));
    if (cachedItem === undefined) {
      throw new NotFoundException(
        'Export not found. It may have expired. We hold on to exports for 5 minutes after creation.'
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
    @Param('claimsetId', new ParseIntPipe()) claimsetId: number
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
    @Body() claimset: PutClaimsetDtoV2
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
    @Body() claimset: PostClaimsetDtoV2
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
    @Body() claimset: CopyClaimsetDtoV2
  ) {
    try {
      return await this.sbService.copyClaimset(edfiTenant, claimset);
    } catch (PostError: unknown) {
      Logger.error(PostError);
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
              400
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
    @Body() claimset: ImportClaimsetSingleDtoV2
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
    @Param('claimsetId', new ParseIntPipe()) claimsetId: number
  ) {
    await this.sbService.deleteClaimset(edfiTenant, claimsetId);
    return undefined;
  }

  //
  // Ods Instances
  //

  @Get('odsinstances')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods:read',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async getOdsInstances(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @InjectFilter('team.sb-environment.edfi-tenant.ods:read')
    validIds: Ids
  ) {
    const allOdsInstances = await this.sbService.getOdsInstances(edfiTenant);
    return allOdsInstances.filter((c) => checkId(c.id, validIds));
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
    validIds: Ids
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
    @Param('profileId', new ParseIntPipe()) profileId: number
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
    @Body() profile: PutProfileDtoV2
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
    @Body() profile: PostProfileDtoV2
  ) {
    try {
      return await this.sbService.postProfile(edfiTenant, profile);
    } catch (error) {
      if (error.response.data.title === 'Validation failed') {
        const errorDefiniton = error.response.data.errors['Definition'][0];
        throw new HttpException(`Invalid XML format for definition: ${errorDefiniton}`, 500);
      } else {
        throw new HttpException('Error creating profile', 500);
      }
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
    @Param('profileId', new ParseIntPipe()) profileId: number
  ) {
    await this.sbService.deleteProfile(edfiTenant, profileId);
    return undefined;
  }
}
