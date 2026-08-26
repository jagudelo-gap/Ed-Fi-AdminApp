import {
  GetUserDto,
  PutEdfiTenantAdminApi,
  PutEdfiTenantAdminApiRegister,
  PutSbEnvironmentDto,
  PutSbEnvironmentMeta,
  toOperationResultDto,
} from '@edanalytics/models';
import { EdfiTenant, SbEnvironment, regarding } from '@edanalytics/models-server';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminApiServiceV1 } from '../teams/edfi-tenants/starting-blocks/v1/admin-api.v1.service';
import { CustomHttpException, throwNotFound } from '../utils';
import {
  StartingBlocksServiceV1,
  StartingBlocksServiceV2,
} from '../teams/edfi-tenants/starting-blocks';
import { EdfiTenantsService } from '../teams/edfi-tenants/edfi-tenants.service';

@Injectable()
export class SbEnvironmentsGlobalService {
  constructor(
    @InjectRepository(SbEnvironment)
    private sbEnvironmentsRepository: Repository<SbEnvironment>,
    private readonly adminApiServiceV1: AdminApiServiceV1,
    private readonly startingBlocksServiceV1: StartingBlocksServiceV1,
    private readonly startingBlocksServiceV2: StartingBlocksServiceV2,
    private readonly edfiTenantService: EdfiTenantsService
  ) {}

  async findOne(id: number) {
    return this.sbEnvironmentsRepository.findOneByOrFail({ id });
  }

  async update(id: number, updateSbEnvironmentDto: PutSbEnvironmentDto) {
    const old = await this.findOne(id);
    return this.sbEnvironmentsRepository.save({
      ...old,
      ...updateSbEnvironmentDto,
    });
  }

  async remove(id: number, _user: GetUserDto) {
    const old = await this.findOne(id).catch(throwNotFound);
    await this.sbEnvironmentsRepository.remove(old);
    return undefined;
  }

  async updateAdminApi(
    sbEnvironment: SbEnvironment,
    edfiTenant: EdfiTenant,
    updateDto: PutEdfiTenantAdminApi
  ) {
    const credentials = {
      ClientId: updateDto.adminKey,
      ClientSecret: updateDto.adminSecret,
      url: updateDto.url,
    };
    if (sbEnvironment.version === 'v2' || sbEnvironment.version === 'v3') {
      await this.startingBlocksServiceV2.saveAdminApiCredentials(
        edfiTenant,
        sbEnvironment,
        credentials
      );
    } else if (sbEnvironment.version === 'v1') {
      await this.startingBlocksServiceV1.saveAdminApiCredentials(sbEnvironment, credentials);
    } else {
      throw new CustomHttpException(
        {
          title: 'Cannot save credentials.',
          message: 'Environment does not have an established version. Please sync metadata first.',
          type: 'Error',
          regarding: regarding(sbEnvironment),
        },
        400
      );
    }
    const updatedSbEnvironment: SbEnvironment = await this.sbEnvironmentsRepository.save(
      Object.assign(sbEnvironment, {
        modifiedById: updateDto.modifiedById,
      })
    );
    edfiTenant.sbEnvironment = updatedSbEnvironment;
    try {
      await this.edfiTenantService.pingAdminApi(edfiTenant);
      return toOperationResultDto({
        title: 'Configuration updated and Admin API connected successfully.',
        type: 'Success',
        regarding: regarding(edfiTenant),
      });
    } catch (pingError) {
      throw new CustomHttpException(
        {
          title: 'Configuration updated but Admin API connection failed.',
          message: pingError.message,
          data: pingError,
          type: 'Error',
          regarding: regarding(edfiTenant),
        },
        400
      );
    }
  }

  async updateMetadataArn(id: number, updateDto: PutSbEnvironmentMeta) {
    const old = await this.findOne(id);
    return await this.sbEnvironmentsRepository.save({
      ...old,
      modifiedById: updateDto.modifiedById,
      configPublic: {
        ...old.configPublic,
        sbEnvironmentMetaArn: updateDto.arn,
      },
    });
  }

  async selfRegisterAdminApiV1(
    sbEnvironment: SbEnvironment,
    updateDto: PutEdfiTenantAdminApiRegister
  ) {
    const registrationResult = await this.adminApiServiceV1.selfRegisterAdminApi(
      updateDto.adminRegisterUrl
    );

    if (registrationResult.status === 'SUCCESS') {
      const { credentials } = registrationResult;
      await this.startingBlocksServiceV1.saveAdminApiCredentials(sbEnvironment, {
        ...credentials,
        url: updateDto.adminRegisterUrl,
      });
      const savedSbEnvironment = await this.sbEnvironmentsRepository.save({
        ...sbEnvironment,
        modifiedById: updateDto.modifiedById,
      });
      return {
        status: registrationResult.status,
        result: savedSbEnvironment,
      };
    } else {
      return registrationResult;
    }
  }
}
