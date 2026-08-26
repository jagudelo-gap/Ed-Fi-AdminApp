import {
  GetApplicationDto,
  GetClaimsetDto,
  Ids,
  PostApplicationDto,
  PostApplicationForm,
  PostClaimsetDto,
  PostVendorDto,
  PutApplicationDto,
  PutApplicationForm,
  PutClaimsetDto,
  PutVendorDto,
  SecretSharingMethod,
  edorgCompositeKey,
  toApplicationYopassResponseDto,
  toPostApplicationResponseDto,
} from '@edanalytics/models';
import { EdfiTenant, Edorg, SbEnvironment } from '@edanalytics/models-server';
import {
  BadRequestException,
  Body,
  CallHandler,
  Controller,
  Delete,
  ExecutionContext,
  ForbiddenException,
  Get,
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
import { In, Repository } from 'typeorm';
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
import { AdminApiV1xExceptionFilter } from './admin-api-v1x-exception.filter';
import { AdminApiServiceV1 } from './admin-api.v1.service';
import {
  ReqEdfiTenant,
  ReqSbEnvironment,
  SbEnvironmentEdfiTenantInterceptor,
} from '../../../../app/sb-environment-edfi-tenant.interceptor';
import config from 'config';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const uppercaseFirstLetterOfKeys = (input: any): any => {
  if (typeof input !== 'object' || input === null) {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map(uppercaseFirstLetterOfKeys);
  }

  return Object.keys(input).reduce((acc, key) => {
    const newKey = key.charAt(0).toUpperCase() + key.slice(1);
    acc[newKey] = uppercaseFirstLetterOfKeys(input[key]);
    return acc;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }, {} as { [key: string]: any });
};

@Injectable()
class AdminApiV1Interceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const configPublic = request.sbEnvironment.configPublic;
    if (!('version' in configPublic && configPublic.version === 'v1')) {
      throw new NotFoundException(
        `Requested Admin API version not correct for this EdfiTenant. Use "${request.sbEnvironment.configPublic.adminApiVersion}" instead.`
      );
    }
    return next.handle();
  }
}

@UseFilters(new AdminApiV1xExceptionFilter())
@UseInterceptors(SbEnvironmentEdfiTenantInterceptor, AdminApiV1Interceptor)
@ApiTags('Admin API Resources - v1.x')
@Controller()
export class AdminApiControllerV1 {
  constructor(
    private readonly sbService: AdminApiServiceV1,
    @InjectRepository(Edorg) private readonly edorgRepository: Repository<Edorg>,
    @InjectRepository(EdfiTenant) private readonly edfiTenantRepository: Repository<EdfiTenant>
  ) {}

  /** Check application edorg IDs against auth cache for _safe_ operations (GET). Requires `some` ID to be authorized. */
  private checkApplicationEdorgsForSafeOperations(
    application: Pick<GetApplicationDto, '_educationOrganizationIds'>,
    validIds: Ids
  ) {
    return application._educationOrganizationIds.some((educationOrganizationId) =>
      checkId(
        edorgCompositeKey({
          edorg: educationOrganizationId,
          ods: '',
        }),
        validIds
      )
    );
  }

  /** Check application edorg IDs against auth cache for _unsafe_ operations (POST/PUT/DELETE). Requires `every` ID to be authorized.
   * Note that IDs which don't exist in SBAA &mdash; either because they haven't synced yet or because they don't exist in EdFi &mdash; can
   * never be authorized via an Edorg or Ods ownership, but _can_ be via an EdfiTenant or SbEnvironment ownership. This is due to some
   * quirks in the SBAA auth system design.
   */
  private checkApplicationEdorgsForUnsafeOperations(
    application: Pick<GetApplicationDto, '_educationOrganizationIds'>,
    validIds: Ids
  ) {
    return application._educationOrganizationIds.every((educationOrganizationId) =>
      checkId(
        edorgCompositeKey({
          edorg: educationOrganizationId,
          ods: '',
        }),
        validIds
      )
    );
  }

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
    @Body() vendor: PutVendorDto
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
    @Body() vendor: PostVendorDto
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

  @Get('vendors/:vendorId/applications')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:read',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async getVendorApplications(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('vendorId', new ParseIntPipe()) vendorId: number,
    @InjectFilter('team.sb-environment.edfi-tenant.ods.edorg.application:read')
    validIds: Ids
  ) {
    const allApplications = await this.sbService.getVendorApplications(edfiTenant, vendorId);
    return allApplications.filter((a) => this.checkApplicationEdorgsForSafeOperations(a, validIds));
  }

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
    return allApplications.filter((a) => this.checkApplicationEdorgsForSafeOperations(a, validIds));
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
      return application;
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
    @Body() application: PutApplicationForm,
    @InjectFilter('team.sb-environment.edfi-tenant.ods.edorg.application:update')
    validIds: Ids
  ) {
    let claimset: GetClaimsetDto;
    try {
      claimset = await this.sbService.getClaimset(edfiTenant, application.claimsetId);
    } catch (claimsetNotFound) {
      Logger.error(claimsetNotFound);
      throw new BadRequestException('Error trying to use claimset');
    }
    if (claimset.isSystemReserved) {
      throw new ValidationHttpException({
        field: 'claimsetId',
        message: 'Cannot use system-reserved claimset',
      });
    }
    let existingApplication: GetApplicationDto;
    try {
      existingApplication = await this.sbService.getApplication(edfiTenant, applicationId);
    } catch (_applicationNotFound) {
      throw new NotFoundException();
    }

    const dto = plainToInstance(PutApplicationDto, {
      ...instanceToPlain(application),
      claimSetName: claimset.name,
      educationOrganizationIds: [application.educationOrganizationId],
    });
    if (this.checkApplicationEdorgsForSafeOperations(existingApplication, validIds)) {
      if (this.checkApplicationEdorgsForUnsafeOperations(existingApplication, validIds)) {
        if (
          this.checkApplicationEdorgsForUnsafeOperations(
            { _educationOrganizationIds: dto.educationOrganizationIds },
            validIds
          )
        ) {
          return this.sbService.putApplication(edfiTenant, applicationId, dto);
        } else {
          throw new ValidationHttpException({
            field: 'educationOrganizationId',
            message: 'Invalid education organization ID or insufficient permissions',
          });
        }
      } else {
        throw new ForbiddenException();
      }
    } else {
      throw new NotFoundException();
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
    @Body() application: PostApplicationForm,
    @InjectFilter('team.sb-environment.edfi-tenant.ods.edorg.application:create')
    validIds: Ids
  ) {
    let claimset: GetClaimsetDto;
    try {
      claimset = await this.sbService.getClaimset(edfiTenant, application.claimsetId);
    } catch (claimsetNotFound) {
      Logger.error(claimsetNotFound);
      throw new BadRequestException('Error trying to use claimset');
    }
    if (claimset.isSystemReserved) {
      throw new ValidationHttpException({
        field: 'claimsetId',
        message: 'Cannot use system-reserved claimset',
      });
    }
    const dto = plainToInstance(PostApplicationDto, {
      ...instanceToPlain(application),
      claimSetName: claimset.name,
      educationOrganizationIds: [application.educationOrganizationId],
    });
    const edorgs = await this.edorgRepository.findBy({
      educationOrganizationId: In([application.educationOrganizationId]),
      edfiTenantId: edfiTenant.id,
    });
    if (!edorgs.length || !edorgs.every((edorg) => edorg.odsDbName === edorgs[0].odsDbName)) {
      throw new ValidationHttpException({
        field: 'educationOrganizationId',
        message: 'Education organizations not all valid and from same ODS',
      });
    }
    if (!sbEnvironment.domain)
      throw new InternalServerErrorException('Environment config lacks an Ed-Fi hostname.');
    if (
      this.checkApplicationEdorgsForUnsafeOperations(
        { _educationOrganizationIds: dto.educationOrganizationIds },
        validIds
      )
    ) {
      const adminApiResponse = await this.sbService.postApplication(edfiTenant, dto);
      if (returnRaw) {
        return toPostApplicationResponseDto(adminApiResponse);
      } else {
        if (asBool(config.USE_YOPASS)) {
          try {
            const yopassResult = await postYopassSecret({
              ...adminApiResponse,
              url: GetApplicationDto.apiUrl(sbEnvironment.startingBlocks, sbEnvironment.domain, application.applicationName),
            });

            return toApplicationYopassResponseDto({
              link: yopassResult.link,
              applicationId: adminApiResponse.applicationId,
              secretSharingMethod: SecretSharingMethod.Yopass,
            });
          } catch (error) {
            Logger.error('Yopass failed for postApplication:', error);
            throw error; // Re-throw the original error
          }
        } else {
          return toPostApplicationResponseDto({
            ...adminApiResponse,
            secretSharingMethod: SecretSharingMethod.Direct,
          });
        }
      }
    } else {
      throw new ValidationHttpException({
        field: 'educationOrganizationId',
        message: 'Invalid education organization ID or insufficient permissions',
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

    if (this.checkApplicationEdorgsForSafeOperations(application, validIds)) {
      if (this.checkApplicationEdorgsForUnsafeOperations(application, validIds)) {
        return this.sbService.deleteApplication(edfiTenant, applicationId);
      } else {
        throw new ForbiddenException();
      }
    } else {
      throw new NotFoundException();
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

    if (!sbEnvironment.domain)
      throw new InternalServerErrorException('Environment config lacks an Ed-Fi hostname.');
    if (this.checkApplicationEdorgsForSafeOperations(application, validIds)) {
      if (this.checkApplicationEdorgsForUnsafeOperations(application, validIds)) {
        const adminApiResponse = await this.sbService.resetApplicationCredentials(
          edfiTenant,
          applicationId
        );
        if (asBool(config.USE_YOPASS)) {
          try {
            const yopassResult = await postYopassSecret({
              ...adminApiResponse,
              secretSharingMethod: SecretSharingMethod.Yopass,
              url: GetApplicationDto.apiUrl(sbEnvironment.startingBlocks, sbEnvironment.domain, application.applicationName),
            });

            return toApplicationYopassResponseDto({
              link: yopassResult.link,
              applicationId: adminApiResponse.applicationId,
              secretSharingMethod: SecretSharingMethod.Yopass,
            });
          } catch (error) {
            Logger.error('Yopass failed for resetApplicationCredentials:', error);
            throw error; // Re-throw the original error
          }
        }
        else {
          return toPostApplicationResponseDto({
            ...adminApiResponse,
            secretSharingMethod: SecretSharingMethod.Direct,
          });
        }
      } else {
        throw new ForbiddenException();
      }
    } else {
      throw new NotFoundException();
    }
  }

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
  @Get('claimsets/export')
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
    @Res() res: Response
  ) {
    if (_ids === undefined) throw new BadRequestException('At least one claimset ID must be provided');
    const ids = Array.isArray(_ids) ? _ids : [_ids];
    const parsedIds = ids.map((id) => {
      const trimmed = id.trim();
      const n = parseInt(trimmed, 10);
      if (isNaN(n) || n <= 0 || n.toString() !== trimmed)
        throw new BadRequestException(`Invalid claimset ID: ${id}`);
      return n;
    });
    for (const id of parsedIds) {
      if (!checkId(id, validIds)) throw new ForbiddenException(`Access denied to claimset ID: ${id}`);
    }
    const claimsets = await Promise.all(
      parsedIds.map((id) => this.sbService.getClaimsetRaw(edfiTenant, id))
    );
    const title =
      claimsets.length === 1 ? claimsets[0].name : `${edfiTenant.sbEnvironment.envLabel} claimsets`;
    const document = {
      title,
      template: {
        claimSets: claimsets.map((c) => ({
          name: c.name,
          resourceClaims: uppercaseFirstLetterOfKeys(c.resourceClaims),
        })),
      },
    };
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${title.replace(/[^\w]+/g, '_')}_${Number(new Date())}.json`
    );
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(document, null, 2));
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
    @Body() claimset: PutClaimsetDto
  ) {
    try {
      return await this.sbService.putClaimset(edfiTenant, claimsetId, claimset);
    } catch (PutError: unknown) {
      Logger.error(PutError);
      // intercept some particular kinds of errors but rethrow the rest to the general exception filter
      if (axios.isAxiosError(PutError)) {
        if (isIAdminApiValidationError(PutError.response?.data)) {
          if (PutError.response.data.errors?.id?.[0]?.includes('is system reserved')) {
            throw new CustomHttpException(
              {
                title: 'Cannot update system-reserved claimset',
                type: 'Error',
                data: PutError.response.data,
              },
              400
            );
          } else {
            // TODO eventually map Admin API validation errors to SBAA react-hook-form
            throw new CustomHttpException(
              {
                title: 'Validation error',
                type: 'Error',
                data: PutError.response.data,
              },
              400
            );
          }
        }
      }
      throw PutError;
    }
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
    @Body() claimset: PostClaimsetDto
  ) {
    try {
      return await this.sbService.postClaimset(edfiTenant, claimset);
    } catch (PostError: unknown) {
      Logger.error(PostError);
      if (axios.isAxiosError(PostError)) {
        if (isIAdminApiValidationError(PostError.response?.data)) {
          if (PostError.response.data.errors?.Name?.[0]?.includes('this name already exists')) {
            throw new CustomHttpException(
              {
                title: 'A claim set with this name already exists',
                type: 'Error',
                data: PostError.response.data,
              },
              400
            );
          } else {
            // TODO eventually map Admin API validation errors to SBAA react-hook-form
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
}
