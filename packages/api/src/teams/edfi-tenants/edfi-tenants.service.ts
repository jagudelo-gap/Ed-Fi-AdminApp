import {
  OperationResultDto,
  PostEdfiTenantDto,
  toGetEdfiTenantDto,
  toOperationResultDto,
} from '@edanalytics/models';
import { EdfiTenant, SbEnvironment, regarding } from '@edanalytics/models-server';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomHttpException, ValidationHttpException } from '../../utils';
import { AdminApiServiceV1, AdminApiServiceV2, StartingBlocksServiceV2 } from './starting-blocks';
import { adminApiLoginStatusMsgs } from './adminApiLoginFailureMsgs';

@Injectable()
export class EdfiTenantsService {
  constructor(
    @InjectRepository(EdfiTenant)
    private edfiTenantsRepository: Repository<EdfiTenant>,
    private readonly startingBlocksServiceV2: StartingBlocksServiceV2,
    private readonly adminApiServiceV1: AdminApiServiceV1,
    private readonly adminApiServiceV2: AdminApiServiceV2
  ) {}

  async create(sbEnvironment: SbEnvironment, tenant: PostEdfiTenantDto) {
    const result = await this.startingBlocksServiceV2.createTenant(sbEnvironment, tenant);
    switch (result.status) {
      case 'INVALID_NAME':
        throw new ValidationHttpException({
          field: 'name',
          message:
            'Invalid tenant name. Lowercase letters and numbers only. "default" and "template" are disallowed.',
        });
      case 'ALREADY_EXISTS':
        throw new ValidationHttpException({
          field: 'name',
          message: 'A tenant by this name already exists.',
        });
      case 'SYNC_FAILED':
        throw new CustomHttpException(
          {
            title: `${tenant.name} is created in Starting Blocks but failed to sync to this app. Please try the sync again later.`,
            message: ('data' in result && result.data?.errorMessage) ?? result.status,
            type: 'Warning',
          },
          500
        );
      case 'SYNC_RESOURCE_TREE_FAILED':
        throw new CustomHttpException(
          {
            title: `${tenant.name} is created in Starting Blocks but the resource tree failed to sync to this app. Please try the sync again later.`,
            type: 'Warning',
          },
          500
        );
      case 'TENANT_RELOAD_FAILED':
        throw new CustomHttpException(
          {
            title: `${tenant.name} is created in Starting Blocks and SBAA but the EdFi servers failed to restart with the changes. Please try reloading tenants again later.`,
            type: 'Warning',
          },
          500
        );
      case 'SUCCESS':
        return toGetEdfiTenantDto(result.edfiTenant);

      case 'NO_CONFIG':
        throw new CustomHttpException(
          {
            title: 'Tenant management function not configured.',
            message: 'No ARN found in environment config.',
            regarding: regarding(sbEnvironment),
            type: 'Error',
          },
          500
        );

      case 'FAILURE':
        throw new CustomHttpException(
          {
            title: 'Failed to create tenant in Starting Blocks',
            message: result.status,
            regarding: regarding(sbEnvironment),
            data: result?.data,
            type: 'Error',
          },
          500
        );
    }
  }

  async delete(sbEnvironment: SbEnvironment, edfiTenant: EdfiTenant) {
    const removeResult = await this.startingBlocksServiceV2.deleteTenant(
      sbEnvironment,
      edfiTenant.name
    );
    if (removeResult.status !== 'SUCCESS') {
      throw new CustomHttpException(
        {
          title: 'Failed to remove tenant.',
          message:
            ('data' in removeResult && removeResult.data?.errorMessage) ?? removeResult.status,
          type: 'Error',
          regarding: regarding(edfiTenant),
        },
        500
      );
    }

    return undefined;
  }

  async pingAdminApi(edfiTenant: EdfiTenant): Promise<OperationResultDto> {
    const result =
      edfiTenant.sbEnvironment.version === 'v1'
        ? await this.adminApiServiceV1.logIntoAdminApi(edfiTenant.sbEnvironment, edfiTenant.id)
        : edfiTenant.sbEnvironment.version === 'v2'
        ? await this.adminApiServiceV2.login(edfiTenant.sbEnvironment, edfiTenant.id, edfiTenant.name)
        : undefined;
    if (!result) {
      throw new Error('Environment lacks defined version and config.');
    }
    if (result.status === 'SUCCESS') {
      return toOperationResultDto({
        title: 'Connection successful.',
        type: 'Success',
        message: adminApiLoginStatusMsgs[result.status],
        regarding: regarding(edfiTenant),
      });
    }
    throw new CustomHttpException(
      {
        title: 'Admin API connection unsuccessful.',
        type: 'Error',
        message: adminApiLoginStatusMsgs[result.status],
        regarding: regarding(edfiTenant),
      },
      500
    );
  }
}
