import 'reflect-metadata';
import { EdfiTenant, Edorg, Ods, SbEnvironment } from '@edanalytics/models-server';
import { EducationOrganizationDto } from '@edanalytics/models';
import { EdorgsService } from './edorgs.service';
import { StartingBlocksServiceV2 } from '../starting-blocks';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CustomHttpException } from '../../../utils';
import { persistSyncTenant } from '../../../sb-sync/sync-ods';

// Mock the persistSyncTenant function
jest.mock('../../../sb-sync/sync-ods', () => ({
  persistSyncTenant: jest.fn(),
}));

/* eslint-disable @typescript-eslint/no-explicit-any */
describe('EdorgsService - syncAllEdOrgs', () => {
  let service: EdorgsService;
  let mockEdorgsRepository: Partial<Repository<Edorg>>;
  let mockOdsRepository: Partial<Repository<Ods>>;
  let mockSbServiceV2: Partial<StartingBlocksServiceV2>;
  let mockAdminApiServiceV2: any;
  let mockAdminApiServiceV3: any;
  let mockDataSource: Partial<DataSource>;
  let mockEntityManager: Partial<EntityManager>;

  const mockSbEnvironment: Partial<SbEnvironment> = {
    id: 1,
    name: 'Test Environment',
    adminApiUrl: 'https://api.test.com',
    version: 'v2',
    configPublic: {
      version: 'v2',
      values: {},
    } as any,
  };

  const mockSbEnvironmentV3: Partial<SbEnvironment> = {
    ...mockSbEnvironment,
    version: 'v3',
    configPublic: {
      version: 'v3',
      values: {},
    } as any,
  };

  const mockEdfiTenant: Partial<EdfiTenant> = {
    id: 1,
    name: 'test-tenant',
    sbEnvironmentId: 1,
    sbEnvironment: mockSbEnvironment as SbEnvironment,
  };

  beforeEach(() => {
    mockEdorgsRepository = {
      findBy: jest.fn(),
      findOneBy: jest.fn(),
    };

    mockOdsRepository = {
      find: jest.fn(),
    };

    mockEntityManager = {};

    mockDataSource = {
      transaction: jest.fn().mockImplementation(async (runInTransaction) => {
        return runInTransaction(mockEntityManager);
      }),
    };

    mockAdminApiServiceV2 = {
      getAllEdOrgsForTenant: jest.fn(),
    };

    mockAdminApiServiceV3 = {
      getAllEdOrgsForTenant: jest.fn(),
    };

    mockSbServiceV2 = {};

    service = new EdorgsService(
      mockEdorgsRepository as Repository<Edorg>,
      mockOdsRepository as Repository<Ods>,
      mockSbServiceV2 as StartingBlocksServiceV2,
      mockAdminApiServiceV2,
      mockAdminApiServiceV3,
      mockDataSource as DataSource
    );

    // Clear mock implementations
    jest.clearAllMocks();
  });

  it('should successfully sync all Ed-Orgs when all ODS instances are found', async () => {
    const mockEdOrgs: EducationOrganizationDto[] = [
      {
        instanceId: 1,
        instanceName: 'ODS One',
        educationOrganizationId: 31,
        nameOfInstitution: 'Grand Bend State',
        shortNameOfInstitution: null,
        discriminator: 'edfi.StateEducationAgency',
        parentId: null,
      },
      {
        instanceId: 1,
        instanceName: 'ODS One',
        educationOrganizationId: 255901,
        nameOfInstitution: 'Grand Bend ISD',
        shortNameOfInstitution: null,
        discriminator: 'edfi.LocalEducationAgency',
        parentId: 31,
      },
      {
        instanceId: 2,
        instanceName: 'ODS Two',
        educationOrganizationId: 255902,
        nameOfInstitution: 'School Two',
        shortNameOfInstitution: 'S2',
        discriminator: 'edfi.School',
        parentId: null,
      },
    ];

    const mockOdsInstances: Partial<Ods>[] = [
      {
        id: 10,
        odsInstanceId: 1,
        odsInstanceName: 'ODS One',
        dbName: 'EdFi_Ods_One',
        edfiTenantId: 1,
      },
      {
        id: 20,
        odsInstanceId: 2,
        odsInstanceName: 'ODS Two',
        dbName: 'EdFi_Ods_Two',
        edfiTenantId: 1,
      },
    ];

    // Mock Admin API call
    (mockAdminApiServiceV2.getAllEdOrgsForTenant as jest.Mock).mockResolvedValue(
      mockEdOrgs
    );

    // Mock ODS repository - fetch all at once
    (mockOdsRepository.find as jest.Mock).mockResolvedValue(mockOdsInstances);

    // Mock persistSyncTenant
    (persistSyncTenant as jest.Mock).mockResolvedValue({
      status: 'SUCCESS',
      data: {
        edorg: { inserted: 3, updated: 0, deleted: 0 },
        ods: { inserted: 0, updated: 0, deleted: 0 },
      },
    });

    const result = await service.syncAllEdOrgs(
      mockSbEnvironment as SbEnvironment,
      mockEdfiTenant as EdfiTenant
    );

    expect(result).toEqual({ synced: 3, skipped: 0 });
    expect(mockAdminApiServiceV2.getAllEdOrgsForTenant).toHaveBeenCalledWith(
      mockEdfiTenant
    );
    expect(mockOdsRepository.find).toHaveBeenCalledWith({
      where: { edfiTenantId: 1 },
    });
    expect(persistSyncTenant).toHaveBeenCalledTimes(1);
    
    // Verify the correct structure was passed to persistSyncTenant
    const callArgs = (persistSyncTenant as jest.Mock).mock.calls[0][0];
    expect(callArgs.odss).toHaveLength(2);
    expect(callArgs.odss[0].id).toBe(1);
    expect(callArgs.odss[0].edorgs).toHaveLength(1); // Root EdOrg (State)
    expect(callArgs.odss[0].edorgs[0].educationorganizationid).toBe(31);
    expect(callArgs.odss[0].edorgs[0].edorgs).toHaveLength(1); // Child (LEA)
    expect(callArgs.odss[0].edorgs[0].edorgs[0].educationorganizationid).toBe(255901);
  });

  it('should skip Ed-Orgs when ODS instance is not found', async () => {
    const mockEdOrgs: EducationOrganizationDto[] = [
      {
        instanceId: 1,
        instanceName: 'ODS One',
        educationOrganizationId: 255901,
        nameOfInstitution: 'School One',
        shortNameOfInstitution: 'S1',
        discriminator: 'edfi.School',
        parentId: null,
      },
      {
        instanceId: 999, // This ODS doesn't exist
        instanceName: 'ODS Missing',
        educationOrganizationId: 255902,
        nameOfInstitution: 'School Two',
        shortNameOfInstitution: 'S2',
        discriminator: 'edfi.School',
        parentId: null,
      },
    ];

    const mockOdsInstances: Partial<Ods>[] = [
      {
        id: 10,
        odsInstanceId: 1,
        odsInstanceName: 'ODS One',
        dbName: 'EdFi_Ods_One',
        edfiTenantId: 1,
      },
    ];

    // Mock Admin API call
    (mockAdminApiServiceV2.getAllEdOrgsForTenant as jest.Mock).mockResolvedValue(
      mockEdOrgs
    );

    // Mock ODS repository - only return ODS with instanceId 1
    (mockOdsRepository.find as jest.Mock).mockResolvedValue(mockOdsInstances);

    // Mock persistSyncTenant
    (persistSyncTenant as jest.Mock).mockResolvedValue({
      status: 'SUCCESS',
      data: {
        edorg: { inserted: 1, updated: 0, deleted: 0 },
        ods: { inserted: 0, updated: 0, deleted: 0 },
      },
    });

    const result = await service.syncAllEdOrgs(
      mockSbEnvironment as SbEnvironment,
      mockEdfiTenant as EdfiTenant
    );

    expect(result).toEqual({ synced: 1, skipped: 1 });
    expect(persistSyncTenant).toHaveBeenCalledTimes(1);
    
    // Verify only one ODS was sent to persistSyncTenant
    const callArgs = (persistSyncTenant as jest.Mock).mock.calls[0][0];
    expect(callArgs.odss).toHaveLength(1);
  });

  it('should return zero synced and skipped when no Ed-Orgs are returned', async () => {
    // Mock Admin API call returning empty array
    (mockAdminApiServiceV2.getAllEdOrgsForTenant as jest.Mock).mockResolvedValue([]);

    const result = await service.syncAllEdOrgs(
      mockSbEnvironment as SbEnvironment,
      mockEdfiTenant as EdfiTenant
    );

    expect(result).toEqual({ synced: 0, skipped: 0 });
    expect(mockOdsRepository.find).not.toHaveBeenCalled();
    expect(persistSyncTenant).not.toHaveBeenCalled();
  });

  it('should skip Ed-Orgs with null or undefined instanceId', async () => {
    const mockEdOrgs: any[] = [
      {
        instanceId: 1,
        educationOrganizationId: 255901,
        nameOfInstitution: 'School One',
      },
      {
        instanceId: null, // Should be skipped
        educationOrganizationId: 255902,
        nameOfInstitution: 'School Two',
      },
      {
        instanceId: undefined, // Should be skipped
        educationOrganizationId: 255903,
        nameOfInstitution: 'School Three',
      },
    ];

    const mockOdsInstances: Partial<Ods>[] = [
      {
        id: 10,
        odsInstanceId: 1,
        odsInstanceName: 'ODS One',
        dbName: 'EdFi_Ods_One',
        edfiTenantId: 1,
      },
    ];

    // Mock Admin API call
    (mockAdminApiServiceV2.getAllEdOrgsForTenant as jest.Mock).mockResolvedValue(
      mockEdOrgs
    );

    // Mock ODS repository
    (mockOdsRepository.find as jest.Mock).mockResolvedValue(mockOdsInstances);

    // Mock persistSyncTenant
    (persistSyncTenant as jest.Mock).mockResolvedValue({
      status: 'SUCCESS',
      data: {
        edorg: { inserted: 1, updated: 0, deleted: 0 },
        ods: { inserted: 0, updated: 0, deleted: 0 },
      },
    });

    const result = await service.syncAllEdOrgs(
      mockSbEnvironment as SbEnvironment,
      mockEdfiTenant as EdfiTenant
    );

    expect(result).toEqual({ synced: 1, skipped: 2 });
    expect(persistSyncTenant).toHaveBeenCalledTimes(1);
  });

  it('should throw CustomHttpException when Admin API call fails', async () => {
    const apiError = new Error('Admin API connection failed');

    // Mock Admin API call to throw error
    (mockAdminApiServiceV2.getAllEdOrgsForTenant as jest.Mock).mockRejectedValue(
      apiError
    );

    await expect(
      service.syncAllEdOrgs(mockSbEnvironment as SbEnvironment, mockEdfiTenant as EdfiTenant)
    ).rejects.toThrow(CustomHttpException);

    expect(mockOdsRepository.find).not.toHaveBeenCalled();
    expect(persistSyncTenant).not.toHaveBeenCalled();
  });

  it('should group multiple Ed-Orgs by ODS instance correctly', async () => {
    const mockEdOrgs: EducationOrganizationDto[] = [
      {
        instanceId: 1,
        instanceName: 'ODS One',
        educationOrganizationId: 255901,
        nameOfInstitution: 'School One',
        shortNameOfInstitution: null,
        discriminator: 'edfi.School',
        parentId: null,
      },
      {
        instanceId: 1, // Same instance as above
        instanceName: 'ODS One',
        educationOrganizationId: 255902,
        nameOfInstitution: 'School Two',
        shortNameOfInstitution: null,
        discriminator: 'edfi.School',
        parentId: null,
      },
      {
        instanceId: 2,
        instanceName: 'ODS Two',
        educationOrganizationId: 255903,
        nameOfInstitution: 'School Three',
        shortNameOfInstitution: null,
        discriminator: 'edfi.School',
        parentId: null,
      },
    ];

    const mockOdsInstances: Partial<Ods>[] = [
      {
        id: 10,
        odsInstanceId: 1,
        odsInstanceName: 'ODS One',
        dbName: 'EdFi_Ods_One',
        edfiTenantId: 1,
      },
      {
        id: 20,
        odsInstanceId: 2,
        odsInstanceName: 'ODS Two',
        dbName: 'EdFi_Ods_Two',
        edfiTenantId: 1,
      },
    ];

    // Mock Admin API call
    (mockAdminApiServiceV2.getAllEdOrgsForTenant as jest.Mock).mockResolvedValue(
      mockEdOrgs
    );

    // Mock ODS repository
    (mockOdsRepository.find as jest.Mock).mockResolvedValue(mockOdsInstances);

    // Mock persistSyncTenant
    (persistSyncTenant as jest.Mock).mockResolvedValue({
      status: 'SUCCESS',
      data: {
        edorg: { inserted: 3, updated: 0, deleted: 0 },
        ods: { inserted: 0, updated: 0, deleted: 0 },
      },
    });

    const result = await service.syncAllEdOrgs(
      mockSbEnvironment as SbEnvironment,
      mockEdfiTenant as EdfiTenant
    );

    expect(result).toEqual({ synced: 3, skipped: 0 });
    expect(persistSyncTenant).toHaveBeenCalledTimes(1); // Called once with all ODS instances
    
    // Verify correct grouping: 2 EdOrgs for instance 1, 1 EdOrg for instance 2
    const callArgs = (persistSyncTenant as jest.Mock).mock.calls[0][0];
    expect(callArgs.odss).toHaveLength(2);
    expect(callArgs.odss[0].edorgs).toHaveLength(2); // Instance 1 has 2 EdOrgs
    expect(callArgs.odss[1].edorgs).toHaveLength(1); // Instance 2 has 1 EdOrg
  });

  it('should use transaction for persistence', async () => {
    const mockEdOrgs: EducationOrganizationDto[] = [
      {
        instanceId: 1,
        instanceName: 'ODS One',
        educationOrganizationId: 255901,
        nameOfInstitution: 'School One',
        shortNameOfInstitution: 'S1',
        discriminator: 'edfi.School',
        parentId: null,
      },
    ];

    const mockOdsInstances: Partial<Ods>[] = [
      {
        id: 10,
        odsInstanceId: 1,
        odsInstanceName: 'ODS One',
        dbName: 'EdFi_Ods_One',
        edfiTenantId: 1,
      },
    ];

    (mockAdminApiServiceV2.getAllEdOrgsForTenant as jest.Mock).mockResolvedValue(
      mockEdOrgs
    );
    (mockOdsRepository.find as jest.Mock).mockResolvedValue(mockOdsInstances);
    (persistSyncTenant as jest.Mock).mockResolvedValue({
      status: 'SUCCESS',
      data: {
        edorg: { inserted: 1, updated: 0, deleted: 0 },
        ods: { inserted: 0, updated: 0, deleted: 0 },
      },
    });

    await service.syncAllEdOrgs(
      mockSbEnvironment as SbEnvironment,
      mockEdfiTenant as EdfiTenant
    );

    expect(mockDataSource.transaction).toHaveBeenCalled();
    expect(persistSyncTenant).toHaveBeenCalledWith(
      expect.objectContaining({
        em: mockEntityManager,
        edfiTenant: mockEdfiTenant,
        odss: expect.arrayContaining([
          expect.objectContaining({
            id: 1,
            dbName: 'EdFi_Ods_One',
          }),
        ]),
      })
    );
  });

  it('calls adminApiServiceV3.getAllEdOrgsForTenant for a v3 tenant', async () => {
    const mockEdOrgs: EducationOrganizationDto[] = [
      {
        instanceId: 1,
        instanceName: 'ODS One',
        educationOrganizationId: 255901,
        nameOfInstitution: 'School One',
        shortNameOfInstitution: null,
        discriminator: 'edfi.School',
        parentId: null,
      },
    ];
    const mockOdsInstances: Partial<Ods>[] = [
      { id: 10, odsInstanceId: 1, odsInstanceName: 'ODS One', dbName: 'EdFi_Ods_One', edfiTenantId: 1 },
    ];

    (mockAdminApiServiceV3.getAllEdOrgsForTenant as jest.Mock).mockResolvedValue(mockEdOrgs);
    (mockOdsRepository.find as jest.Mock).mockResolvedValue(mockOdsInstances);
    (persistSyncTenant as jest.Mock).mockResolvedValue({
      status: 'SUCCESS',
      data: {
        edorg: { inserted: 1, updated: 0, deleted: 0 },
        ods: { inserted: 0, updated: 0, deleted: 0 },
      },
    });

    const result = await service.syncAllEdOrgs(
      mockSbEnvironmentV3 as SbEnvironment,
      mockEdfiTenant as EdfiTenant
    );

    expect(result).toEqual({ synced: 1, skipped: 0 });
    expect(mockAdminApiServiceV3.getAllEdOrgsForTenant).toHaveBeenCalledWith(mockEdfiTenant);
    expect(mockAdminApiServiceV2.getAllEdOrgsForTenant).not.toHaveBeenCalled();
  });

  it('still calls adminApiServiceV2.getAllEdOrgsForTenant for a v2 tenant', async () => {
    (mockAdminApiServiceV2.getAllEdOrgsForTenant as jest.Mock).mockResolvedValue([]);

    await service.syncAllEdOrgs(mockSbEnvironment as SbEnvironment, mockEdfiTenant as EdfiTenant);

    expect(mockAdminApiServiceV2.getAllEdOrgsForTenant).toHaveBeenCalledWith(mockEdfiTenant);
    expect(mockAdminApiServiceV3.getAllEdOrgsForTenant).not.toHaveBeenCalled();
  });
});
