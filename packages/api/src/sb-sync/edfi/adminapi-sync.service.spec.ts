/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getEntityManagerToken, getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { EdfiTenant, SbEnvironment } from '@edanalytics/models-server';
import { TenantDto } from '@edanalytics/models';
import { AdminApiSyncService } from './adminapi-sync.service';
import type { AdminApiServiceV1 } from '../../teams/edfi-tenants/starting-blocks';
import { AdminApiServiceV2 } from '../../teams/edfi-tenants/starting-blocks';
import { CacheService } from '../../app/cache.module';
import { AdminApiVersionStrategyFactory } from '../../admin-api-version-strategy';
import * as adminApiDataAdapterUtils from '../../utils/admin-api-data-adapter-utils';
import * as syncOds from '../sync-ods';

describe('AdminApiSyncService', () => {
  let service: AdminApiSyncService;
  let adminApiServiceV1: jest.Mocked<AdminApiServiceV1>;
  let adminApiServiceV2: jest.Mocked<AdminApiServiceV2>;
  let edfiTenantsRepository: jest.Mocked<Repository<EdfiTenant>>;
  let entityManager: jest.Mocked<EntityManager>;
  let strategyFactory: { getStrategy: jest.Mock };
  let v1Strategy: {
    version: string;
    getAdminApiService: jest.Mock;
    bootstrapCredentials: jest.Mock;
    provisionCredentialsForNewTenants: jest.Mock;
    getTenantModeDefault: jest.Mock;
  };
  let v2Strategy: {
    version: string;
    getAdminApiService: jest.Mock;
    bootstrapCredentials: jest.Mock;
    provisionCredentialsForNewTenants: jest.Mock;
    getTenantModeDefault: jest.Mock;
  };

  const mockSbEnvironmentV1: Partial<SbEnvironment> = {
    id: 1,
    name: 'Test Environment V1',
    adminApiUrl: 'https://api.test.com',
    version: 'v1',
    configPublic: {
      version: 'v1',
      values: {
        edfiHostname: 'test.edfi.org',
        adminApiUrl: 'https://api.test.com',
        adminApiKey: 'test-key',
      },
      adminApiUrl: 'https://api.test.com',
      startingBlocks: false,
    } as any,
    configPrivate: {
      adminApiSecret: 'test-secret',
    } as any,
  };

  const mockSbEnvironmentV2: Partial<SbEnvironment> = {
    id: 2,
    name: 'Test Environment V2',
    adminApiUrl: 'https://api.test.com',
    version: 'v2',
    configPublic: {
      version: 'v2',
      values: {
        edfiHostname: 'test.edfi.org',
        tenants: {
          'tenant-one': {
            adminApiKey: 'key1',
          },
          'tenant-two': {
            adminApiKey: 'key2',
          },
        },
      },
      adminApiUrl: 'https://api.test.com',
      startingBlocks: false,
    } as any,
    configPrivate: {
      tenants: {
        'tenant-one': {
          adminApiSecret: 'secret1',
        },
        'tenant-two': {
          adminApiSecret: 'secret2',
        },
      },
    } as any,
  };

  const mockTenantDto: TenantDto = {
    id: 'tenant-1',
    name: 'tenant-one',
    odsInstances: [
      {
        id: 1,
        name: 'ODS One',
        instanceType: 'Production',
        edOrgs: [
          {
            instanceId: 1,
            instanceName: 'ODS One',
            educationOrganizationId: 255901,
            nameOfInstitution: 'School One',
            shortNameOfInstitution: 'S1',
            discriminator: 'edfi.School',
            parentId: 255900,
          },
        ],
      },
    ],
  };

  const mockEdfiTenant: Partial<EdfiTenant> = {
    id: 1,
    name: 'tenant-one',
    sbEnvironmentId: 1,
    created: new Date(),
    odss: [],
  };

  beforeEach(async () => {
    const mockEdfiTenantsRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };

    const mockEntityManager = {
      transaction: jest.fn(),
      getRepository: jest.fn().mockReturnValue({
        delete: jest.fn().mockResolvedValue({ affected: 0 }),
      }),
    };

    const mockSbEnvironmentsRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };

    const mockAdminApiServiceV1 = {
      getTenants: jest.fn(),
    };

    const mockAdminApiServiceV2 = {
      getTenants: jest.fn(),
      getAdminApiClientForEnvironment: jest.fn(),
      triggerEdOrgRefresh: jest.fn().mockResolvedValue(null),
      pollJobStatus: jest.fn().mockResolvedValue('timeout'),
    };

    v1Strategy = {
      version: 'v1',
      getAdminApiService: jest.fn().mockReturnValue(mockAdminApiServiceV1),
      bootstrapCredentials: jest.fn().mockResolvedValue(undefined),
      provisionCredentialsForNewTenants: jest.fn().mockResolvedValue(undefined),
      getTenantModeDefault: jest.fn().mockReturnValue(false),
    };
    v2Strategy = {
      version: 'v2',
      getAdminApiService: jest.fn().mockReturnValue(mockAdminApiServiceV2),
      bootstrapCredentials: jest.fn().mockResolvedValue(undefined),
      provisionCredentialsForNewTenants: jest.fn().mockResolvedValue(undefined),
      getTenantModeDefault: jest.fn(
        (env: SbEnvironment) => (env?.configPublic?.values as { meta?: { mode?: string } })?.meta?.mode === 'MultiTenant'
      ),
    };
    strategyFactory = {
      getStrategy: jest.fn((version: string) => {
        if (version === 'v1') return v1Strategy;
        if (version === 'v2') return v2Strategy;
        throw new Error(`Invalid API version: ${version}`);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminApiSyncService,
        {
          provide: AdminApiServiceV2,
          useValue: mockAdminApiServiceV2,
        },
        {
          provide: getRepositoryToken(EdfiTenant),
          useValue: mockEdfiTenantsRepository,
        },
        {
          provide: getRepositoryToken(SbEnvironment),
          useValue: mockSbEnvironmentsRepository,
        },
        {
          provide: getEntityManagerToken(),
          useValue: mockEntityManager,
        },
        {
          provide: CacheService,
          useValue: { flushAll: jest.fn() },
        },
        {
          provide: AdminApiVersionStrategyFactory,
          useValue: strategyFactory,
        },
      ],
    }).compile();

    service = module.get<AdminApiSyncService>(AdminApiSyncService);
    adminApiServiceV1 = mockAdminApiServiceV1 as unknown as jest.Mocked<AdminApiServiceV1>;
    adminApiServiceV2 = module.get(AdminApiServiceV2) as jest.Mocked<AdminApiServiceV2>;
    edfiTenantsRepository = module.get(getRepositoryToken(EdfiTenant)) as jest.Mocked<
      Repository<EdfiTenant>
    >;
    entityManager = module.get(getEntityManagerToken()) as jest.Mocked<EntityManager>;

    // Default: no tenants in DB (orphan cleanup won't delete anything in most tests)
    edfiTenantsRepository.find.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('syncEnvironmentData', () => {
    describe('validation', () => {
      it('should return NO_ADMIN_API_CONFIG when adminApiUrl is missing', async () => {
        const envWithoutUrl = { ...mockSbEnvironmentV1, adminApiUrl: undefined };

        const result = await service.syncEnvironmentData(envWithoutUrl as SbEnvironment);

        expect(result.status).toBe('NO_ADMIN_API_CONFIG');
        expect(result.message).toContain('Admin API URL is not configured');
      });

      it('should return INVALID_VERSION when version is missing', async () => {
        const envWithoutVersion = { ...mockSbEnvironmentV1, version: undefined };

        const result = await service.syncEnvironmentData(envWithoutVersion as SbEnvironment);

        expect(result.status).toBe('INVALID_VERSION');
        expect(result.message).toContain('Invalid API version');
      });

      it('should return INVALID_VERSION when version is not v1 or v2', async () => {
        const envWithInvalidVersion = { ...mockSbEnvironmentV1, version: 'v3' as any };

        const result = await service.syncEnvironmentData(envWithInvalidVersion as SbEnvironment);

        expect(result.status).toBe('INVALID_VERSION');
        expect(result.message).toContain('Invalid API version: v3');
      });
    });

    describe('v1 environment sync', () => {
      it('should successfully sync v1 environment with one tenant', async () => {
        const environment = mockSbEnvironmentV1 as SbEnvironment;
        const tenants = [mockTenantDto];

        adminApiServiceV1.getTenants.mockResolvedValue(tenants);
        edfiTenantsRepository.findOne.mockResolvedValue(null);
        edfiTenantsRepository.save.mockResolvedValue(mockEdfiTenant as EdfiTenant);

        jest.spyOn(adminApiDataAdapterUtils, 'transformTenantData').mockReturnValue({
          name: 'tenant-one',
          sbEnvironmentId: 1,
          odss: [
            {
              odsInstanceId: 1,
              odsInstanceName: 'ODS One',
              edorgs: [
                {
                  educationOrganizationId: 255901,
                  nameOfInstitution: 'School One',
                  shortNameOfInstitution: 'S1',
                  discriminator: 'edfi.School' as any,
                  parentId: 255900,
                },
              ],
            },
          ],
        } as any);

        const persistSyncTenantSpy = jest
          .spyOn(syncOds, 'persistSyncTenant')
          .mockResolvedValue(undefined);

        entityManager.transaction.mockImplementation(async (callback: any) => {
          return callback(entityManager);
        });

        const result = await service.syncEnvironmentData(environment);

        expect(result.status).toBe('SUCCESS');
        expect(result.tenantsProcessed).toBe(1);
        expect(adminApiServiceV1.getTenants).toHaveBeenCalledWith(environment);
        expect(edfiTenantsRepository.save).toHaveBeenCalled();
        expect(persistSyncTenantSpy).toHaveBeenCalled();
      });

      it('should use existing tenant if found', async () => {
        const environment = mockSbEnvironmentV1 as SbEnvironment;
        const tenants = [mockTenantDto];

        adminApiServiceV1.getTenants.mockResolvedValue(tenants);
        edfiTenantsRepository.findOne.mockResolvedValue(mockEdfiTenant as EdfiTenant);

        jest.spyOn(adminApiDataAdapterUtils, 'transformTenantData').mockReturnValue({
          name: 'tenant-one',
          sbEnvironmentId: 1,
          odss: [
            {
              odsInstanceId: 1,
              odsInstanceName: 'ODS One',
              edorgs: [],
            },
          ],
        } as any);

        jest.spyOn(syncOds, 'persistSyncTenant').mockResolvedValue(undefined);

        entityManager.transaction.mockImplementation(async (callback: any) => {
          return callback(entityManager);
        });

        const result = await service.syncEnvironmentData(environment);

        expect(result.status).toBe('SUCCESS');
        expect(edfiTenantsRepository.findOne).toHaveBeenCalledWith({
          where: {
            name: 'tenant-one',
            sbEnvironmentId: 1,
          },
          relations: ['odss', 'odss.edorgs'],
        });
        expect(edfiTenantsRepository.save).not.toHaveBeenCalled();
      });
    });

    describe('v2 environment sync', () => {
      it('should successfully sync v2 environment by calling syncTenantData per tenant', async () => {
        const environment = mockSbEnvironmentV2 as SbEnvironment;
        const tenants = [
          mockTenantDto,
          { ...mockTenantDto, id: 'tenant-2', name: 'tenant-two' },
        ];

        adminApiServiceV2.getTenants.mockResolvedValue(tenants);

        // findOne: first call in syncEnvironmentData (find-or-create), second in syncTenantData (with relations)
        edfiTenantsRepository.findOne
          .mockResolvedValueOnce(mockEdfiTenant as EdfiTenant)  // syncEnvironmentData find for tenant-one
          .mockResolvedValueOnce(mockEdfiTenant as EdfiTenant)  // syncTenantData reload for tenant-one
          .mockResolvedValueOnce(null)                          // syncEnvironmentData find for tenant-two (not found)
          .mockResolvedValueOnce({ ...mockEdfiTenant, id: 2, name: 'tenant-two', sbEnvironment: mockSbEnvironmentV2 } as any); // syncTenantData reload

        edfiTenantsRepository.save.mockResolvedValue({ ...mockEdfiTenant, id: 2, name: 'tenant-two' } as EdfiTenant);

        // Spy on syncTenantData so we don\'t need to wire up the entire Admin API v2 chain
        const syncTenantDataSpy = jest
          .spyOn(service as any, 'syncTenantData')
          .mockResolvedValue({ status: 'SUCCESS', message: 'synced' });
        adminApiServiceV2.triggerEdOrgRefresh.mockResolvedValue(null);

        const result = await service.syncEnvironmentData(environment);

        expect(result.status).toBe('SUCCESS');
        expect(result.tenantsProcessed).toBe(2);
        expect(adminApiServiceV2.getTenants).toHaveBeenCalledWith(environment);
        expect(syncTenantDataSpy).toHaveBeenCalledTimes(2);
      });

      it('should use v2 service for v2 environment', async () => {
        const environment = mockSbEnvironmentV2 as SbEnvironment;
        adminApiServiceV2.getTenants.mockResolvedValue([]);

        await service.syncEnvironmentData(environment);

        expect(adminApiServiceV2.getTenants).toHaveBeenCalledWith(environment);
        expect(adminApiServiceV1.getTenants).not.toHaveBeenCalled();
      });

      describe('EdOrg refresh integration', () => {
        it('should call triggerEdOrgRefresh and pollJobStatus before syncing tenants in a v2 environment', async () => {
          const environment = mockSbEnvironmentV2 as SbEnvironment;
          const tenants = [mockTenantDto];

          adminApiServiceV2.getTenants.mockResolvedValue(tenants);
          edfiTenantsRepository.findOne.mockResolvedValue(mockEdfiTenant as EdfiTenant);

          adminApiServiceV2.triggerEdOrgRefresh.mockResolvedValue('job-xyz');
          adminApiServiceV2.pollJobStatus.mockResolvedValue('completed');
          const syncTenantDataSpy = jest
            .spyOn(service as any, 'syncTenantData')
            .mockResolvedValue({ status: 'SUCCESS' });

          await service.syncEnvironmentData(environment);

          // Both refresh methods (now owned by the version-specific Admin API service,
          // not AdminApiSyncService) and syncTenantData should have been called
          expect(adminApiServiceV2.triggerEdOrgRefresh).toHaveBeenCalledWith(
            expect.objectContaining({ id: environment.id })
          );
          expect(adminApiServiceV2.pollJobStatus).toHaveBeenCalledWith(
            expect.objectContaining({ id: environment.id }),
            'job-xyz'
          );
          expect(syncTenantDataSpy).toHaveBeenCalled();
        });

        it('should still sync tenants when triggerEdOrgRefresh returns null (refresh unavailable)', async () => {
          const environment = mockSbEnvironmentV2 as SbEnvironment;
          adminApiServiceV2.getTenants.mockResolvedValue([mockTenantDto]);
          edfiTenantsRepository.findOne.mockResolvedValue(mockEdfiTenant as EdfiTenant);

          adminApiServiceV2.triggerEdOrgRefresh.mockResolvedValue(null);
          jest.spyOn(service as any, 'syncTenantData').mockResolvedValue({ status: 'SUCCESS' });

          const result = await service.syncEnvironmentData(environment);

          expect(adminApiServiceV2.pollJobStatus).not.toHaveBeenCalled();
          expect(result.status).toBe('SUCCESS');
        });

        it('should still sync tenants when the refresh job fails', async () => {
          const environment = mockSbEnvironmentV2 as SbEnvironment;
          adminApiServiceV2.getTenants.mockResolvedValue([mockTenantDto]);
          edfiTenantsRepository.findOne.mockResolvedValue(mockEdfiTenant as EdfiTenant);

          adminApiServiceV2.triggerEdOrgRefresh.mockResolvedValue('job-fail');
          adminApiServiceV2.pollJobStatus.mockResolvedValue('failed');
          jest.spyOn(service as any, 'syncTenantData').mockResolvedValue({ status: 'SUCCESS' });
          const errorSpy = jest.spyOn((service as any).logger, 'error');

          const result = await service.syncEnvironmentData(environment);

          expect(result.status).toBe('SUCCESS');
          expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('EdOrg refresh job'));
        });

        it('should not call triggerEdOrgRefresh for v1 environments', async () => {
          const environment = mockSbEnvironmentV1 as SbEnvironment;
          adminApiServiceV1.getTenants.mockResolvedValue([mockTenantDto]);
          edfiTenantsRepository.findOne.mockResolvedValue(mockEdfiTenant as EdfiTenant);
          jest
            .spyOn(adminApiDataAdapterUtils, 'transformTenantData')
            .mockReturnValue({ name: 'tenant-one', sbEnvironmentId: 1, odss: [] } as any);
          jest.spyOn(syncOds, 'persistSyncTenant').mockResolvedValue(undefined);
          entityManager.transaction.mockImplementation(async (cb: any) => cb(entityManager));

          await service.syncEnvironmentData(environment);

          // v1's strategy doesn't expose triggerEdOrgRefresh, so the v2 mock must be untouched
          expect(adminApiServiceV2.triggerEdOrgRefresh).not.toHaveBeenCalled();
        });
      });
    });

    describe('tenant discovery', () => {
      it('should return success with 0 tenants when no tenants found', async () => {
        const environment = mockSbEnvironmentV1 as SbEnvironment;
        adminApiServiceV1.getTenants.mockResolvedValue([]);

        const result = await service.syncEnvironmentData(environment);

        expect(result.status).toBe('SUCCESS');
        expect(result.message).toContain('No tenants found to sync');
        expect(result.tenantsProcessed).toBe(0);
      });

      it('should return success with 0 tenants when getTenants returns null', async () => {
        const environment = mockSbEnvironmentV1 as SbEnvironment;
        adminApiServiceV1.getTenants.mockResolvedValue(null as any);

        const result = await service.syncEnvironmentData(environment);

        expect(result.status).toBe('SUCCESS');
        expect(result.tenantsProcessed).toBe(0);
      });
    });

    describe('ODS and EdOrg processing', () => {
      it('should call persistSyncTenant even when API returns empty ODS list so stale records are delta-deleted', async () => {
        const environment = mockSbEnvironmentV1 as SbEnvironment;
        const tenantWithoutOds = { ...mockTenantDto, odsInstances: [] };

        adminApiServiceV1.getTenants.mockResolvedValue([tenantWithoutOds]);
        edfiTenantsRepository.findOne.mockResolvedValue(mockEdfiTenant as EdfiTenant);

        jest.spyOn(adminApiDataAdapterUtils, 'transformTenantData').mockReturnValue({
          name: 'tenant-one',
          sbEnvironmentId: 1,
          odss: [],
        } as any);

        const persistSyncTenantSpy = jest
          .spyOn(syncOds, 'persistSyncTenant')
          .mockResolvedValue(undefined);

        entityManager.transaction.mockImplementation(async (callback: any) => {
          return callback(entityManager);
        });

        const result = await service.syncEnvironmentData(environment);

        expect(result.status).toBe('SUCCESS');
        // persistSyncTenant MUST be called even with empty ODS — computeOdsListDeltas inside
        // it will mark stale existing rows for deletion without explicit bulk deletes.
        expect(persistSyncTenantSpy).toHaveBeenCalledWith({
          em: entityManager,
          edfiTenant: mockEdfiTenant,
          odss: [],
        });
      });

      it('should sync ODS instances with education organizations', async () => {
        const environment = mockSbEnvironmentV1 as SbEnvironment;
        adminApiServiceV1.getTenants.mockResolvedValue([mockTenantDto]);
        edfiTenantsRepository.findOne.mockResolvedValue(mockEdfiTenant as EdfiTenant);

        jest.spyOn(adminApiDataAdapterUtils, 'transformTenantData').mockReturnValue({
          name: 'tenant-one',
          sbEnvironmentId: 1,
          odss: [
            {
              odsInstanceId: 1,
              odsInstanceName: 'ODS One',
              edorgs: [
                {
                  educationOrganizationId: 255901,
                  nameOfInstitution: 'School One',
                  shortNameOfInstitution: 'S1',
                  discriminator: 'edfi.School' as any,
                  parentId: 255900,
                },
              ],
            },
          ],
        } as any);

        const persistSyncTenantSpy = jest
          .spyOn(syncOds, 'persistSyncTenant')
          .mockResolvedValue(undefined);

        entityManager.transaction.mockImplementation(async (callback: any) => {
          return callback(entityManager);
        });

        const result = await service.syncEnvironmentData(environment);

        expect(result.status).toBe('SUCCESS');
        expect(persistSyncTenantSpy).toHaveBeenCalledWith({
          em: entityManager,
          edfiTenant: mockEdfiTenant,
          odss: expect.arrayContaining([
            expect.objectContaining({
              id: 1,
              name: 'ODS One',
              dbName: 'ODS One',
              edorgs: expect.arrayContaining([
                expect.objectContaining({
                  educationorganizationid: 255901,
                  nameofinstitution: 'School One',
                  shortnameofinstitution: 'S1',
                  discriminator: 'edfi.School',
                  parent: 255900,
                }),
              ]),
            }),
          ]),
        });
      });
    });

    describe('orphaned tenant cleanup', () => {
      it('should delete tenants in DB that are no longer returned by the Admin API', async () => {
        const environment = mockSbEnvironmentV1 as SbEnvironment;
        adminApiServiceV1.getTenants.mockResolvedValue([mockTenantDto]); // only tenant-one

        edfiTenantsRepository.findOne.mockResolvedValue(mockEdfiTenant as EdfiTenant);

        jest.spyOn(adminApiDataAdapterUtils, 'transformTenantData').mockReturnValue({
          name: 'tenant-one',
          sbEnvironmentId: 1,
          odss: [],
        } as any);

        jest.spyOn(syncOds, 'persistSyncTenant').mockResolvedValue(undefined);
        entityManager.transaction.mockImplementation(async (callback: any) => callback(entityManager));

        // DB has two tenants but API only returns one
        const orphanTenant = { id: 99, name: 'orphan-tenant', sbEnvironmentId: 1 };
        edfiTenantsRepository.find.mockResolvedValue([
          mockEdfiTenant as EdfiTenant,
          orphanTenant as EdfiTenant,
        ]);
        edfiTenantsRepository.delete = jest.fn().mockResolvedValue({ affected: 1 });

        const result = await service.syncEnvironmentData(environment);

        expect(result.status).toBe('SUCCESS');
        expect(edfiTenantsRepository.delete).toHaveBeenCalledWith([99]);
      });

      it('should not delete any tenants when all DB tenants are returned by the API', async () => {
        const environment = mockSbEnvironmentV1 as SbEnvironment;
        adminApiServiceV1.getTenants.mockResolvedValue([mockTenantDto]);

        edfiTenantsRepository.findOne.mockResolvedValue(mockEdfiTenant as EdfiTenant);

        jest.spyOn(adminApiDataAdapterUtils, 'transformTenantData').mockReturnValue({
          name: 'tenant-one',
          sbEnvironmentId: 1,
          odss: [],
        } as any);

        jest.spyOn(syncOds, 'persistSyncTenant').mockResolvedValue(undefined);
        entityManager.transaction.mockImplementation(async (callback: any) => callback(entityManager));

        // DB has the same tenant as the API returned
        edfiTenantsRepository.find.mockResolvedValue([mockEdfiTenant as EdfiTenant]);
        edfiTenantsRepository.delete = jest.fn().mockResolvedValue({ affected: 0 });

        const result = await service.syncEnvironmentData(environment);

        expect(result.status).toBe('SUCCESS');
        expect(edfiTenantsRepository.delete).not.toHaveBeenCalled();
      });
    });

    describe('credential provisioning and re-fetch', () => {
      const mockSbEnvironmentV2MultiTenant: Partial<SbEnvironment> = {
        id: 3,
        name: 'Test Multi-Tenant V2',
        adminApiUrl: 'https://api.test.com',
        version: 'v2',
        configPublic: {
          version: 'v2',
          values: {
            meta: { mode: 'MultiTenant' },
            tenants: { 'tenant-one': { adminApiKey: 'key1' } },
          },
          adminApiUrl: 'https://api.test.com',
          startingBlocks: false,
        } as any,
        configPrivate: {
          tenants: { 'tenant-one': { adminApiSecret: 'secret1' } },
        } as any,
      };

      it('should provision credentials for newly discovered tenants and then call syncTenantData (no second getTenants call)', async () => {
        const environment = mockSbEnvironmentV2MultiTenant as SbEnvironment;

        // getTenants is called ONCE — new code delegates to syncTenantData per tenant
        // rather than re-fetching from getTenants
        const discoveredTenants = [
          { ...mockTenantDto, name: 'tenant-one' },
          { ...mockTenantDto, name: 'tenant-two' },
        ];
        adminApiServiceV2.getTenants.mockResolvedValue(discoveredTenants as any);

        v2Strategy.provisionCredentialsForNewTenants.mockResolvedValue(undefined);

        const sbEnvironmentsRepository = (service as any).sbEnvironmentsRepository;
        sbEnvironmentsRepository.findOne.mockResolvedValue(environment);

        edfiTenantsRepository.findOne.mockResolvedValue(null);
        edfiTenantsRepository.save.mockResolvedValue(mockEdfiTenant as EdfiTenant);

        const syncTenantDataSpy = jest
          .spyOn(service as any, 'syncTenantData')
          .mockResolvedValue({ status: 'SUCCESS', message: 'synced' });
        adminApiServiceV2.triggerEdOrgRefresh.mockResolvedValue(null);

        const result = await service.syncEnvironmentData(environment);

        expect(result.status).toBe('SUCCESS');
        // getTenants called exactly ONCE — credential provisioning no longer triggers a re-fetch
        expect(adminApiServiceV2.getTenants).toHaveBeenCalledTimes(1);
        expect(v2Strategy.provisionCredentialsForNewTenants).toHaveBeenCalled();
        // syncTenantData called once per discovered tenant
        expect(syncTenantDataSpy).toHaveBeenCalledTimes(2);
      });
    });

    describe('delta-based ODS sync per tenant', () => {
      it('should call persistSyncTenant with mapped syncableOdss — no explicit bulk deletes', async () => {
        const environment = mockSbEnvironmentV1 as SbEnvironment;
        adminApiServiceV1.getTenants.mockResolvedValue([mockTenantDto]);
        edfiTenantsRepository.findOne.mockResolvedValue(mockEdfiTenant as EdfiTenant);

        jest.spyOn(adminApiDataAdapterUtils, 'transformTenantData').mockReturnValue({
          name: 'tenant-one',
          sbEnvironmentId: 1,
          odss: [
            {
              odsInstanceId: 5,
              odsInstanceName: 'Fresh ODS',
              edorgs: [],
            },
          ],
        } as any);

        const persistSyncTenantSpy = jest
          .spyOn(syncOds, 'persistSyncTenant')
          .mockResolvedValue(undefined);

        entityManager.transaction.mockImplementation(async (callback: any) => callback(entityManager));

        await service.syncEnvironmentData(environment);

        // persistSyncTenant is called with the mapped ODS — delta logic inside handles inserts/updates/deletes.
        expect(persistSyncTenantSpy).toHaveBeenCalledWith({
          em: entityManager,
          edfiTenant: mockEdfiTenant,
          odss: expect.arrayContaining([
            expect.objectContaining({ id: 5, name: 'Fresh ODS', dbName: 'Fresh ODS' }),
          ]),
        });
        // No explicit bulk deletes should occur outside persistSyncTenant
        expect(entityManager.getRepository).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'Edorg' }));
      });
    });

    describe('error handling', () => {
      it('should continue processing other tenants if one fails', async () => {
        const environment = mockSbEnvironmentV1 as SbEnvironment;
        const tenants = [
          mockTenantDto,
          { ...mockTenantDto, id: 'tenant-2', name: 'tenant-two' },
        ];

        adminApiServiceV1.getTenants.mockResolvedValue(tenants);
        edfiTenantsRepository.findOne
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(mockEdfiTenant as EdfiTenant);
        edfiTenantsRepository.save.mockRejectedValueOnce(new Error('Database error'));

        jest.spyOn(adminApiDataAdapterUtils, 'transformTenantData').mockReturnValue({
          name: 'tenant-one',
          sbEnvironmentId: 1,
          odss: [],
        } as any);

        const result = await service.syncEnvironmentData(environment);

        expect(result.status).toBe('SUCCESS');
        expect(result.tenantsProcessed).toBe(1);
        expect(result.message).toContain('1 of 2');
      });

      it('should return ERROR status when getTenants fails', async () => {
        const environment = mockSbEnvironmentV1 as SbEnvironment;
        const error = new Error('Admin API connection failed');
        adminApiServiceV1.getTenants.mockRejectedValue(error);

        const result = await service.syncEnvironmentData(environment);

        expect(result.status).toBe('ERROR');
        expect(result.message).toBe('Admin API connection failed');
        expect(result.error).toBe(error);
      });

      it('should handle transformTenantData errors', async () => {
        const environment = mockSbEnvironmentV1 as SbEnvironment;
        adminApiServiceV1.getTenants.mockResolvedValue([mockTenantDto]);
        edfiTenantsRepository.findOne.mockResolvedValue(null);

        jest
          .spyOn(adminApiDataAdapterUtils, 'transformTenantData')
          .mockImplementation(() => {
            throw new Error('Transform error');
          });

        const result = await service.syncEnvironmentData(environment);

        expect(result.status).toBe('SUCCESS');
        expect(result.tenantsProcessed).toBe(0);
      });

      it('should handle persistSyncTenant errors', async () => {
        const environment = mockSbEnvironmentV1 as SbEnvironment;
        adminApiServiceV1.getTenants.mockResolvedValue([mockTenantDto]);
        edfiTenantsRepository.findOne.mockResolvedValue(mockEdfiTenant as EdfiTenant);

        jest.spyOn(adminApiDataAdapterUtils, 'transformTenantData').mockReturnValue({
          name: 'tenant-one',
          sbEnvironmentId: 1,
          odss: [
            {
              odsInstanceId: 1,
              odsInstanceName: 'ODS One',
              edorgs: [],
            },
          ],
        } as any);

        jest.spyOn(syncOds, 'persistSyncTenant').mockRejectedValue(new Error('Sync error'));

        entityManager.transaction.mockImplementation(async (callback: any) => {
          return callback(entityManager);
        });

        const result = await service.syncEnvironmentData(environment);

        expect(result.status).toBe('SUCCESS');
        expect(result.tenantsProcessed).toBe(0);
      });
    });
  });

  describe('syncTenantData', () => {
    const mockEdfiTenantWithEnvironment: Partial<EdfiTenant> & { sbEnvironment: SbEnvironment } = {
      id: 1,
      name: 'tenant-one',
      sbEnvironmentId: 1,
      created: new Date(),
      odss: [],
      sbEnvironment: mockSbEnvironmentV1 as SbEnvironment,
    };

    const mockEdfiTenantV2WithEnvironment: Partial<EdfiTenant> & { sbEnvironment: SbEnvironment } = {
      id: 2,
      name: 'tenant-two',
      sbEnvironmentId: 2,
      created: new Date(),
      odss: [],
      sbEnvironment: mockSbEnvironmentV2 as SbEnvironment,
    };

    beforeEach(() => {
      // Reset mocks for each test
      jest.clearAllMocks();
      jest.restoreAllMocks();
    });

    describe('validation', () => {
      it('should return ERROR when tenant not found', async () => {
        edfiTenantsRepository.findOne.mockResolvedValue(null);

        const result = await (service as any).syncTenantData(mockEdfiTenant as EdfiTenant);

        expect(result.status).toBe('ERROR');
        expect(result.message).toContain('Tenant not found or missing environment');
      });

      it('should return ERROR when tenant has no environment', async () => {
        const tenantWithoutEnv = { ...mockEdfiTenant, sbEnvironment: null };
        edfiTenantsRepository.findOne.mockResolvedValue(tenantWithoutEnv as any);

        const result = await (service as any).syncTenantData(mockEdfiTenant as EdfiTenant);

        expect(result.status).toBe('ERROR');
        expect(result.message).toContain('Tenant not found or missing environment');
      });

      it('should return NO_ADMIN_API_CONFIG when environment has no Admin API URL', async () => {
        const tenantWithInvalidEnv = {
          ...mockEdfiTenantWithEnvironment,
          sbEnvironment: { ...mockSbEnvironmentV1, adminApiUrl: undefined },
        };
        edfiTenantsRepository.findOne.mockResolvedValue(tenantWithInvalidEnv as any);

        const result = await (service as any).syncTenantData(mockEdfiTenant as EdfiTenant);

        expect(result.status).toBe('NO_ADMIN_API_CONFIG');
        expect(result.message).toContain('Admin API URL is not configured');
      });

      it('should return INVALID_VERSION when environment has invalid version', async () => {
        const tenantWithInvalidVersion = {
          ...mockEdfiTenantWithEnvironment,
          sbEnvironment: { ...mockSbEnvironmentV1, version: 'v3' as any },
        };
        edfiTenantsRepository.findOne.mockResolvedValue(tenantWithInvalidVersion as any);

        const result = await (service as any).syncTenantData(mockEdfiTenant as EdfiTenant);

        expect(result.status).toBe('INVALID_VERSION');
        expect(result.message).toContain('Invalid API version');
      });
    });

    describe('v1 tenant sync', () => {
      it('should return ERROR for v1 environments (single-tenant only)', async () => {
        edfiTenantsRepository.findOne.mockResolvedValue(mockEdfiTenantWithEnvironment as EdfiTenant);

        const result = await (service as any).syncTenantData(mockEdfiTenant as EdfiTenant);

        expect(result.status).toBe('ERROR');
        expect(result.message).toContain('V1 Admin API is single-tenant');
        expect(result.message).toContain('Use syncEnvironmentData');
      });
    });

    describe('v2 tenant sync', () => {
      const mockEdfiTenantV2WithEnvironment: Partial<EdfiTenant> & { sbEnvironment: SbEnvironment } = {
        id: 2,
        name: 'tenant-two',
        sbEnvironmentId: 2,
        created: new Date(),
        odss: [],
        sbEnvironment: mockSbEnvironmentV2 as SbEnvironment,
      };

      it('should successfully sync v2 tenant with multiple ODS instances', async () => {
        const tenantDetailsV2 = {
          odsInstances: [
            {
              id: 1,
              odsInstanceManageId: 101,
              name: 'ODS One',
              instanceType: 'Production',
              educationOrganizations: [
                {
                  educationOrganizationId: 255901,
                  nameOfInstitution: 'School One',
                  discriminator: 'edfi.School',
                },
              ],
            },
            {
              id: 2,
              odsInstanceManageId: 202,
              name: 'ODS Two',
              instanceType: 'Production',
              educationOrganizations: [
                {
                  educationOrganizationId: 255902,
                  nameOfInstitution: 'School Two',
                  discriminator: 'edfi.LocalEducationAgency',
                },
              ],
            },
          ],
        };

        edfiTenantsRepository.findOne.mockResolvedValue(mockEdfiTenantV2WithEnvironment as EdfiTenant);

        const mockApiClient = {
          get: jest.fn().mockResolvedValue(tenantDetailsV2),
        };

        (adminApiServiceV2 as any)['getAdminApiClient'] = jest.fn().mockReturnValue(mockApiClient);

        const persistSyncTenantSpy = jest
          .spyOn(syncOds, 'persistSyncTenant')
          .mockResolvedValue(undefined);

        entityManager.transaction.mockImplementation(async (callback: any) => {
          return callback(entityManager);
        });

        const result = await (service as any).syncTenantData({ id: 2, name: 'tenant-two' } as EdfiTenant);

        expect(result.status).toBe('SUCCESS');
        expect(result.message).toContain('Successfully synced 2 ODS instance');
        expect(mockApiClient.get).toHaveBeenCalledWith('tenants/tenant-two/odsInstances/edOrgs');
        expect(persistSyncTenantSpy).toHaveBeenCalled();
        const callArgs = persistSyncTenantSpy.mock.calls[0][0];
        expect(callArgs.odss[0].instanceManageId).toBe(101);
        expect(callArgs.odss[1].instanceManageId).toBe(202);
      });

      it('should use correct v2 endpoint format', async () => {
        edfiTenantsRepository.findOne.mockResolvedValue(mockEdfiTenantV2WithEnvironment as EdfiTenant);

        const mockApiClient = {
          get: jest.fn().mockResolvedValue({ odsInstances: [] }),
        };

        (adminApiServiceV2 as any)['getAdminApiClient'] = jest.fn().mockReturnValue(mockApiClient);

        await (service as any).syncTenantData({ id: 2, name: 'tenant-two' } as EdfiTenant);

        expect(mockApiClient.get).toHaveBeenCalledWith('tenants/tenant-two/odsInstances/edOrgs');
      });
    });

    describe('error handling', () => {
      it('should return ERROR when Admin API call fails', async () => {
        edfiTenantsRepository.findOne.mockResolvedValue(mockEdfiTenantV2WithEnvironment as EdfiTenant);

        const apiError = new Error('Admin API connection failed');
        const mockApiClient = {
          get: jest.fn().mockRejectedValue(apiError),
        };

        (adminApiServiceV2 as any)['getAdminApiClient'] = jest.fn().mockReturnValue(mockApiClient);

        const result = await (service as any).syncTenantData({ id: 2, name: 'tenant-two' } as EdfiTenant);

        expect(result.status).toBe('ERROR');
        expect(result.message).toContain('Admin API call failed');
        expect(result.error).toBe(apiError);
      });

      it('should return ERROR when persistence fails', async () => {
        const tenantDetailsV2 = {
          odsInstances: [
            {
              id: 1,
              name: 'ODS One',
              instanceType: 'Production',
              educationOrganizations: [
                {
                  educationOrganizationId: 255901,
                  nameOfInstitution: 'School One',
                  discriminator: 'edfi.School',
                },
              ],
            },
          ],
        };

        edfiTenantsRepository.findOne.mockResolvedValue(mockEdfiTenantV2WithEnvironment as EdfiTenant);

        const mockApiClient = {
          get: jest.fn().mockResolvedValue(tenantDetailsV2),
        };

        (adminApiServiceV2 as any)['getAdminApiClient'] = jest.fn().mockReturnValue(mockApiClient);

        const persistError = new Error('Database error');
        jest.spyOn(syncOds, 'persistSyncTenant').mockRejectedValue(persistError);

        entityManager.transaction.mockImplementation(async (callback: any) => {
          return callback(entityManager);
        });

        const result = await (service as any).syncTenantData({ id: 2, name: 'tenant-two' } as EdfiTenant);

        expect(result.status).toBe('ERROR');
        expect(result.error).toBe(persistError);
      });

      it('should handle education organizations with missing optional fields', async () => {
        const detailsWithPartialData = {
          odsInstances: [
            {
              id: 1,
              name: 'ODS One',
              instanceType: 'Production',
              educationOrganizations: [
                {
                  educationOrganizationId: 255901,
                  nameOfInstitution: 'School One',
                  // Missing shortNameOfInstitution and parentId
                  discriminator: 'edfi.School',
                },
              ],
            },
          ],
        };

        edfiTenantsRepository.findOne.mockResolvedValue(mockEdfiTenantV2WithEnvironment as EdfiTenant);

        const mockApiClient = {
          get: jest.fn().mockResolvedValue(detailsWithPartialData),
        };

        (adminApiServiceV2 as any)['getAdminApiClient'] = jest.fn().mockImplementation((_tenant) => {
          return mockApiClient;
        });

        const persistSyncTenantSpy = jest
          .spyOn(syncOds, 'persistSyncTenant')
          .mockResolvedValue(undefined);

        entityManager.transaction.mockImplementation(async (callback: any) => {
          return callback(entityManager);
        });

        const result = await (service as any).syncTenantData({ id: 2, name: 'tenant-two' } as EdfiTenant);

        expect(result.status).toBe('SUCCESS');
        expect(persistSyncTenantSpy).toHaveBeenCalled();
        
        // Verify the call arguments
        const callArgs = persistSyncTenantSpy.mock.calls[0][0];
        expect(callArgs.em).toBe(entityManager);
        expect(callArgs.edfiTenant).toMatchObject({
          id: 2,
          name: 'tenant-two',
          sbEnvironmentId: 2,
        });
        expect(callArgs.odss).toHaveLength(1);
        expect(callArgs.odss[0].edorgs).toHaveLength(1);
        expect(callArgs.odss[0].edorgs[0]).toMatchObject({
          educationorganizationid: 255901,
          nameofinstitution: 'School One',
          shortnameofinstitution: null,
          discriminator: 'edfi.School',
          parent: undefined,
        });
      });
    });
  });

  // triggerEdOrgRefresh/pollJobStatus now live on each version's Admin API service
  // (AdminApiServiceV1/V2/V3), not on AdminApiSyncService — see the per-version specs.

  describe('AdminApiSyncService — v3', () => {
    let service: AdminApiSyncService;
    let strategyFactory: { getStrategy: jest.Mock };
    let v3Strategy: {
      version: string;
      getAdminApiService: jest.Mock;
      bootstrapCredentials: jest.Mock;
      provisionCredentialsForNewTenants: jest.Mock;
      getTenantModeDefault: jest.Mock;
    };
    let edfiTenantsRepository: { findOne: jest.Mock; save: jest.Mock; find: jest.Mock };
    let sbEnvironmentsRepository: { findOne: jest.Mock };
    let cacheService: { flushAll: jest.Mock };

    const mockSbEnvironmentV3: any = {
      id: 3,
      name: 'Test Environment V3',
      adminApiUrl: 'https://api.test.com',
      version: 'v3',
      configPublic: {
        version: 'v3',
        values: { meta: { mode: 'SingleTenant' }, tenants: { default: { adminApiKey: 'key' } } },
        adminApiUrl: 'https://api.test.com',
      },
      configPrivate: { tenants: { default: { adminApiSecret: 'secret' } } },
    };

    beforeEach(async () => {
      const adminApiServiceV3Mock = {
        getTenants: jest.fn().mockResolvedValue([{ id: 'default', name: 'default', odsInstances: [] }]),
        getAdminApiClient: jest.fn(),
        triggerEdOrgRefresh: jest.fn().mockResolvedValue(null),
        pollJobStatus: jest.fn().mockResolvedValue('timeout'),
      };

      v3Strategy = {
        version: 'v3',
        getAdminApiService: jest.fn().mockReturnValue(adminApiServiceV3Mock),
        bootstrapCredentials: jest.fn().mockResolvedValue(undefined),
        provisionCredentialsForNewTenants: jest.fn().mockResolvedValue(undefined),
        getTenantModeDefault: jest.fn(
          (env: SbEnvironment) => (env?.configPublic?.values as { meta?: { mode?: string } })?.meta?.mode === 'MultiTenant'
        ),
      };
      strategyFactory = { getStrategy: jest.fn().mockReturnValue(v3Strategy) };

      edfiTenantsRepository = {
        findOne: jest.fn().mockResolvedValue({ id: 1, name: 'default', sbEnvironmentId: 3 }),
        save: jest.fn(),
        find: jest.fn().mockResolvedValue([]),
      };
      sbEnvironmentsRepository = { findOne: jest.fn().mockResolvedValue(mockSbEnvironmentV3) };
      cacheService = { flushAll: jest.fn() };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AdminApiSyncService,
          { provide: AdminApiServiceV2, useValue: {} },
          { provide: getRepositoryToken(EdfiTenant), useValue: edfiTenantsRepository },
          { provide: getRepositoryToken(SbEnvironment), useValue: sbEnvironmentsRepository },
          { provide: getEntityManagerToken(), useValue: { transaction: jest.fn((cb) => cb({ getRepository: jest.fn() })) } },
          { provide: CacheService, useValue: cacheService },
          { provide: AdminApiVersionStrategyFactory, useValue: strategyFactory },
        ],
      }).compile();

      service = module.get(AdminApiSyncService);
    });

    it('syncEnvironmentData resolves the v3 strategy, bootstraps credentials, and syncs tenants', async () => {
      const result = await service.syncEnvironmentData(mockSbEnvironmentV3);

      expect(strategyFactory.getStrategy).toHaveBeenCalledWith('v3');
      expect(v3Strategy.bootstrapCredentials).toHaveBeenCalled();
      expect(result.status).toBe('SUCCESS');
    });

    it('syncEnvironmentData returns INVALID_VERSION when the factory throws for an unknown version', async () => {
      strategyFactory.getStrategy.mockImplementation(() => {
        throw new Error('Invalid API version: v9');
      });

      const result = await service.syncEnvironmentData({ ...mockSbEnvironmentV3, version: 'v9' } as any);

      expect(result.status).toBe('INVALID_VERSION');
    });

    describe('syncTenantData — v3', () => {
      it('uses the v3 dataStores endpoint, falls back to dataStoreType, and maps the ODS/EdOrg data', async () => {
        const adminApiServiceV3Mock = v3Strategy.getAdminApiService();
        const mockApiClient = {
          get: jest.fn().mockResolvedValue({
            id: 'default',
            name: 'default',
            dataStores: [
              {
                id: 10,
                name: 'ODS v3 One',
                dataStoreManageId: 505,
                // Deliberately omit `instanceType` and only supply `dataStoreType`
                // so the `instanceType ?? dataStoreType` fallback is exercised.
                dataStoreType: 'Ods',
                educationOrganizations: [
                  {
                    educationOrganizationId: 255901,
                    nameOfInstitution: 'V3 School',
                    shortNameOfInstitution: 'V3S',
                    discriminator: 'edfi.School',
                    parentId: 255900,
                  },
                ],
              },
            ],
          }),
        };
        adminApiServiceV3Mock.getAdminApiClient = jest.fn().mockReturnValue(mockApiClient);

        edfiTenantsRepository.findOne.mockResolvedValue({
          id: 1,
          name: 'default',
          sbEnvironmentId: 3,
          odss: [],
          sbEnvironment: mockSbEnvironmentV3,
        });

        const persistSyncTenantSpy = jest
          .spyOn(syncOds, 'persistSyncTenant')
          .mockResolvedValue(undefined);

        const result = await service.syncTenantData({ id: 1, name: 'default' } as any);

        // Endpoint construction: v3 uses `dataStores/edOrgs`, not `odsInstances/edOrgs`.
        expect(mockApiClient.get).toHaveBeenCalledWith('tenants/default/dataStores/edOrgs');

        expect(result.status).toBe('SUCCESS');
        expect(result.message).toContain('Successfully synced 1 ODS instance');

        // Confirm the `dataStores` payload was actually mapped through to persistence,
        // with `instanceType` falling back to `dataStoreType`.
        expect(persistSyncTenantSpy).toHaveBeenCalled();
        const persistArgs = persistSyncTenantSpy.mock.calls[0][0] as any;
        expect(persistArgs.odss).toHaveLength(1);
        expect(persistArgs.odss[0]).toMatchObject({
          id: 10,
          name: 'ODS v3 One',
          instanceManageId: 505,
          instanceType: 'Ods',
        });
        expect(persistArgs.odss[0].edorgs).toHaveLength(1);
        expect(persistArgs.odss[0].edorgs[0]).toMatchObject({
          educationorganizationid: 255901,
          nameofinstitution: 'V3 School',
          shortnameofinstitution: 'V3S',
          discriminator: 'edfi.School',
          parent: 255900,
        });
      });
    });
  });
});
