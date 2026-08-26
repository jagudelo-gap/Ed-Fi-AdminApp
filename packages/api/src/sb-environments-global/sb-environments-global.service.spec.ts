import 'reflect-metadata';
import { EdfiTenant, SbEnvironment } from '@edanalytics/models-server';
import { PutEdfiTenantAdminApi } from '@edanalytics/models';
import { Repository } from 'typeorm';
import { SbEnvironmentsGlobalService } from './sb-environments-global.service';
import { AdminApiServiceV1 } from '../teams/edfi-tenants/starting-blocks/v1/admin-api.v1.service';
import {
  StartingBlocksServiceV1,
  StartingBlocksServiceV2,
} from '../teams/edfi-tenants/starting-blocks';
import { EdfiTenantsService } from '../teams/edfi-tenants/edfi-tenants.service';

describe('SbEnvironmentsGlobalService - updateAdminApi', () => {
  let service: SbEnvironmentsGlobalService;
  let mockRepository: { save: jest.Mock };
  let mockAdminApiServiceV1: Partial<AdminApiServiceV1>;
  let mockStartingBlocksServiceV1: { saveAdminApiCredentials: jest.Mock };
  let mockStartingBlocksServiceV2: { saveAdminApiCredentials: jest.Mock };
  let mockEdfiTenantService: { pingAdminApi: jest.Mock };

  const updateDto = {
    adminKey: 'key',
    adminSecret: 'secret',
    url: 'https://api.test.com',
    modifiedById: 1,
  };

  beforeEach(() => {
    mockRepository = {
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };
    mockAdminApiServiceV1 = {};
    mockStartingBlocksServiceV1 = { saveAdminApiCredentials: jest.fn().mockResolvedValue(undefined) };
    mockStartingBlocksServiceV2 = { saveAdminApiCredentials: jest.fn().mockResolvedValue(undefined) };
    mockEdfiTenantService = {
      pingAdminApi: jest.fn().mockResolvedValue(undefined),
    };

    service = new SbEnvironmentsGlobalService(
      mockRepository as unknown as Repository<SbEnvironment>,
      mockAdminApiServiceV1 as AdminApiServiceV1,
      mockStartingBlocksServiceV1 as unknown as StartingBlocksServiceV1,
      mockStartingBlocksServiceV2 as unknown as StartingBlocksServiceV2,
      mockEdfiTenantService as unknown as EdfiTenantsService
    );
  });

  it('reuses StartingBlocksServiceV2.saveAdminApiCredentials for v3 environments', async () => {
    const sbEnvironment = { version: 'v3' } as SbEnvironment;
    const edfiTenant = { sbEnvironmentId: 1 } as EdfiTenant;

    await service.updateAdminApi(sbEnvironment, edfiTenant, updateDto as unknown as PutEdfiTenantAdminApi);

    expect(mockStartingBlocksServiceV2.saveAdminApiCredentials).toHaveBeenCalledWith(
      edfiTenant,
      sbEnvironment,
      { ClientId: 'key', ClientSecret: 'secret', url: 'https://api.test.com' }
    );
    expect(mockStartingBlocksServiceV1.saveAdminApiCredentials).not.toHaveBeenCalled();
  });

  it('still uses StartingBlocksServiceV2.saveAdminApiCredentials for v2 environments (unchanged)', async () => {
    const sbEnvironment = { version: 'v2' } as SbEnvironment;
    const edfiTenant = { sbEnvironmentId: 1 } as EdfiTenant;

    await service.updateAdminApi(sbEnvironment, edfiTenant, updateDto as unknown as PutEdfiTenantAdminApi);

    expect(mockStartingBlocksServiceV2.saveAdminApiCredentials).toHaveBeenCalledWith(
      edfiTenant,
      sbEnvironment,
      { ClientId: 'key', ClientSecret: 'secret', url: 'https://api.test.com' }
    );
  });

  it('still throws for an unrecognized version (unchanged)', async () => {
    const sbEnvironment = { version: undefined } as unknown as SbEnvironment;
    const edfiTenant = { sbEnvironmentId: 1 } as EdfiTenant;

    await expect(
      service.updateAdminApi(sbEnvironment, edfiTenant, updateDto as unknown as PutEdfiTenantAdminApi)
    ).rejects.toThrow('Environment does not have an established version. Please sync metadata first.');
  });
});

