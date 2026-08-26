import 'reflect-metadata';
import { SbEnvironment } from '@edanalytics/models-server';
import { AdminApiServiceV2 } from './admin-api.v2.service';
import { StartingBlocksServiceV2 } from './starting-blocks.v2.service';
import { AxiosError } from 'axios';
import { CustomHttpException } from '../../../../utils';

/* eslint-disable @typescript-eslint/no-explicit-any */
describe('AdminApiServiceV2 - Extension Methods', () => {
  let service: AdminApiServiceV2;
  let mockStartingBlocksService: Partial<StartingBlocksServiceV2>;

  const mockSbEnvironment: Partial<SbEnvironment> = {
    id: 1,
    name: 'Test Environment',
    adminApiUrl: 'https://api.test.com',
    configPublic: {
      version: 'v2',
      values: {
        tenants: {
          'test-tenant': {
            adminApiKey: 'test-key',
          },
        },
      },
    } as any,
    configPrivate: {
      version: 'v2',
      tenants: {
        'test-tenant': {
          adminApiSecret: 'test-secret',
        },
      },
    } as any,
  };

  // Helper function to create proper AxiosError mocks
  const createAxiosError = (status: number, message: string): Partial<AxiosError> => ({
    isAxiosError: true,
    message,
    name: 'AxiosError',
    config: {} as any,
    toJSON: () => ({}),
    response: {
      status,
      statusText: message,
      data: {},
      headers: {},
      config: {} as any,
    },
  });

  beforeEach(() => {
    mockStartingBlocksService = {
      saveAdminApiCredentials: jest.fn(),
    };
    service = new AdminApiServiceV2(mockStartingBlocksService as StartingBlocksServiceV2);
  });

  describe('getTenants', () => {
    it('should successfully return tenants in multi-tenant mode with EdOrgs and odsInstances', async () => {
      const environment = mockSbEnvironment as SbEnvironment;

      // Mock root endpoint response with multi-tenant mode
      const mockRootResponse = {
        data: {
          tenancy: {
            multitenantMode: true,
            tenants: ['tenant-one', 'tenant-two'],
          },
          version: '2.0',
          build: '2.3.2.0',
        },
      };

      // Mock tenant details responses (camelCase format)
      const mockDetailsResponseOne = {
        data: {
          id: 'tenant-one',
          name: 'Tenant One',
          odsInstances: [
            {
              id: 1,
              name: 'ODS One',
              odsInstanceManageId: 101,
              instanceType: 'Production',
              educationOrganizations: [
                {
                  educationOrganizationId: 255901,
                  nameOfInstitution: 'School One',
                  shortNameOfInstitution: 'S1',
                  discriminator: 'edfi.School',
                  parentId: 255900,
                },
              ],
            },
          ],
        },
      };

      const mockDetailsResponseTwo = {
        data: {
          id: 'tenant-two',
          name: 'Tenant Two',
          odsInstances: [
            {
              id: 2,
              name: 'ODS Two',
              odsInstanceManageId: null,
              instanceType: 'Test',
              educationOrganizations: [
                {
                  educationOrganizationId: 255902,
                  nameOfInstitution: 'School Two',
                  discriminator: 'edfi.School',
                },
              ],
            },
          ],
        },
      };

      // Mock axios client for root endpoint
      const mockRootGet = jest.fn().mockResolvedValue(mockRootResponse);
      jest.spyOn(require('axios'), 'create').mockReturnValue({
        get: mockRootGet,
      });

      // Mock login method to return success
      jest.spyOn(service as any, 'login').mockResolvedValue({ status: 'SUCCESS' });

      // Mock admin API client for tenant details
      const mockApiGet = jest.fn()
        .mockResolvedValueOnce(mockDetailsResponseOne)
        .mockResolvedValueOnce(mockDetailsResponseTwo);

      jest.spyOn(service as any, 'initializeApiClient').mockReturnValue({
        get: mockApiGet,
      });

      // Mock token cache to return tenant-specific tokens
      (service as any).adminApiTokens.get = jest.fn((key: string) => {
        if (key === '1-tenant-one') return 'token-tenant-one';
        if (key === '1-tenant-two') return 'token-tenant-two';
        return 'mock-token';
      });

      const result = await service.getTenants(environment);

      expect(result).toHaveLength(2);
      expect(mockRootGet).toHaveBeenCalledWith('/', expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-token',
        }),
      }));
      expect(mockApiGet).toHaveBeenCalledWith('tenants/tenant-one/odsInstances/edOrgs', expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-tenant-one',
          tenant: 'tenant-one',
        }),
      }));
      expect(mockApiGet).toHaveBeenCalledWith('tenants/tenant-two/odsInstances/edOrgs', expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-tenant-two',
          tenant: 'tenant-two',
        }),
      }));

      // Verify first tenant
      expect(result[0]).toMatchObject({
        id: 'tenant-one',
        name: 'tenant-one',
      });
      expect(result[0].odsInstances).toHaveLength(1);
      expect(result[0].odsInstances![0]).toMatchObject({
        id: 1,
        name: 'ODS One',
        instanceManageId: 101,
        instanceType: 'Production',
      });
      expect(result[0].odsInstances![0].edOrgs).toHaveLength(1);
      expect(result[0].odsInstances![0].edOrgs![0]).toMatchObject({
        instanceId: 1,
        instanceName: 'ODS One',
        educationOrganizationId: 255901,
        nameOfInstitution: 'School One',
        shortNameOfInstitution: 'S1',
        discriminator: 'edfi.School',
        parentId: 255900,
      });

      // Verify second tenant
      expect(result[1]).toMatchObject({
        id: 'tenant-two',
        name: 'tenant-two',
      });
      expect(result[1].odsInstances).toHaveLength(1);
      expect(result[1].odsInstances![0].id).toBe(2);
      expect(result[1].odsInstances![0].instanceManageId).toBeNull();
      expect(result[1].odsInstances![0].edOrgs).toHaveLength(1);
      expect(result[1].odsInstances![0].edOrgs![0]).toMatchObject({
        instanceId: 2,
        instanceName: 'ODS Two',
        educationOrganizationId: 255902,
        nameOfInstitution: 'School Two',
        discriminator: 'edfi.School',
      });
    });

    it('should use default tenant in single-tenant mode (multitenantMode: false)', async () => {
      const environment = mockSbEnvironment as SbEnvironment;

      // Mock root endpoint response with single-tenant mode
      const mockRootResponse = {
        data: {
          tenancy: {
            multitenantMode: false,
            tenants: [],
          },
          version: '2.0',
          build: '2.3.2.0',
        },
      };

      const mockDefaultTenantDetails = {
        data: {
          id: 'default',
          name: 'Default',
          odsInstances: [
            {
              id: 1,
              name: 'ODS Default',
              instanceType: 'Production',
              educationOrganizations: [],
            },
          ],
        },
      };

      // Mock axios client for root endpoint
      const mockRootGet = jest.fn().mockResolvedValue(mockRootResponse);
      jest.spyOn(require('axios'), 'create').mockReturnValue({
        get: mockRootGet,
      });

      // Mock login method to return success
      jest.spyOn(service as any, 'login').mockResolvedValue({ status: 'SUCCESS' });

      // Mock admin API client for tenant details
      const mockApiGet = jest.fn().mockResolvedValueOnce(mockDefaultTenantDetails);

      jest.spyOn(service as any, 'initializeApiClient').mockReturnValue({
        get: mockApiGet,
      });

      // Mock token cache to return tenant-specific tokens
      (service as any).adminApiTokens.get = jest.fn((key: string) => {
        if (key === '1-default') return 'token-default';
        return 'mock-token';
      });

      const result = await service.getTenants(environment);

      expect(result).toHaveLength(1);
      expect(mockApiGet).toHaveBeenCalledWith('tenants/default/odsInstances/edOrgs', expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-default',
          tenant: 'default',
        }),
      }));
      expect(result[0]).toMatchObject({
        id: 'default',
        name: 'default',
      });
    });

    it('should handle tenant details endpoint failure gracefully', async () => {
      const environment = mockSbEnvironment as SbEnvironment;

      const mockRootResponse = {
        data: {
          tenancy: {
            multitenantMode: true,
            tenants: ['tenant-one'],
          },
          version: '2.0',
          build: '2.3.2.0',
        },
      };

      // Mock axios client for root endpoint
      const mockRootGet = jest.fn().mockResolvedValue(mockRootResponse);
      jest.spyOn(require('axios'), 'create').mockReturnValue({
        get: mockRootGet,
      });

      // Mock login method to return success
      jest.spyOn(service as any, 'login').mockResolvedValue({ status: 'SUCCESS' });

      // Mock tenant details endpoint to fail
      const mockApiGet = jest.fn().mockRejectedValueOnce(new Error('Details endpoint error'));

      jest.spyOn(service as any, 'initializeApiClient').mockReturnValue({
        get: mockApiGet,
      });

      // Mock token cache to return tenant-specific tokens
      (service as any).adminApiTokens.get = jest.fn((key: string) => {
        if (key === '1-tenant-one') return 'token-tenant-one';
        return 'mock-token';
      });

      const result = await service.getTenants(environment);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'tenant-one',
        name: 'tenant-one',
        odsInstances: [],
      });
    });

    it('should fallback to default tenant when root endpoint returns 404', async () => {
      const environment = mockSbEnvironment as SbEnvironment;

      const axiosError = createAxiosError(404, 'Not Found');

      // Mock axios client for root endpoint to return 404
      jest.spyOn(require('axios'), 'create').mockReturnValue({
        get: jest.fn().mockRejectedValue(axiosError),
      });

      // Mock token cache
      (service as any).adminApiTokens.get = jest.fn().mockReturnValue('mock-token');

      const result = await service.getTenants(environment);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'default',
        name: 'Test Environment',
        odsInstances: [],
      });
    });

    it('should use "Default Tenant" when environment name is empty and endpoint returns 404', async () => {
      const envWithoutName = { ...mockSbEnvironment, name: '' } as SbEnvironment;

      const axiosError = createAxiosError(404, 'Not Found');

      // Mock axios client for root endpoint to return 404
      jest.spyOn(require('axios'), 'create').mockReturnValue({
        get: jest.fn().mockRejectedValue(axiosError),
      });

      // Mock token cache
      (service as any).adminApiTokens.get = jest.fn().mockReturnValue('mock-token');

      const result = await service.getTenants(envWithoutName);

      expect(result[0].name).toBe('Default Tenant');
    });

    it('should throw error for non-404 errors (auth, network, server errors)', async () => {
      const environment = mockSbEnvironment as SbEnvironment;

      const axiosError = createAxiosError(401, 'Unauthorized');

      // Mock axios client for root endpoint to return 401
      jest.spyOn(require('axios'), 'create').mockReturnValue({
        get: jest.fn().mockRejectedValue(axiosError),
      });

      // Mock token cache
      (service as any).adminApiTokens.get = jest.fn().mockReturnValue('mock-token');

      await expect(service.getTenants(environment)).rejects.toMatchObject({
        message: 'Unauthorized',
      });
    });

    it('should return TenantDto array with correct structure', async () => {
      const environment = mockSbEnvironment as SbEnvironment;

      const mockRootResponse = {
        data: {
          tenancy: {
            multitenantMode: true,
            tenants: ['tenant-one'],
          },
          version: '2.0',
          build: '2.3.2.0',
        },
      };

      const mockDetailsResponse = {
        data: {
          id: 'tenant-one',
          name: 'Tenant One',
          odsInstances: [
            {
              id: 1,
              name: 'ODS One',
              educationOrganizations: [],
            },
          ],
        },
      };

      // Mock axios client for root endpoint
      const mockRootGet = jest.fn().mockResolvedValue(mockRootResponse);
      jest.spyOn(require('axios'), 'create').mockReturnValue({
        get: mockRootGet,
      });

      // Mock login method to return success
      jest.spyOn(service as any, 'login').mockResolvedValue({ status: 'SUCCESS' });

      // Mock admin API client for tenant details
      const mockApiGet = jest.fn().mockResolvedValueOnce(mockDetailsResponse);

      jest.spyOn(service as any, 'initializeApiClient').mockReturnValue({
        get: mockApiGet,
      });

      // Mock token cache to return tenant-specific tokens
      (service as any).adminApiTokens.get = jest.fn((key: string) => {
        if (key === '1-tenant-one') return 'token-tenant-one';
        return 'mock-token';
      });

      const result = await service.getTenants(environment);

      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('odsInstances');
      expect(result[0].odsInstances![0]).toHaveProperty('edOrgs');
      expect(typeof result[0].id).toBe('string');
      expect(typeof result[0].name).toBe('string');
      expect(Array.isArray(result[0].odsInstances)).toBe(true);
      expect(Array.isArray(result[0].odsInstances![0].edOrgs)).toBe(true);
    });

    it('should set ODS instance ID to null when id is missing', async () => {
      const environment = mockSbEnvironment as SbEnvironment;

      const mockRootResponse = {
        data: {
          tenancy: {
            multitenantMode: true,
            tenants: ['tenant-one'],
          },
          version: '2.0',
          build: '2.3.2.0',
        },
      };

      const mockDetailsResponse = {
        data: {
          id: 'tenant-one',
          name: 'Tenant One',
          odsInstances: [
            { name: 'ODS 1', instanceType: 'Type1', educationOrganizations: [] },
            { name: 'ODS 2', instanceType: 'Type2', educationOrganizations: [] },
          ],
        },
      };

      // Mock axios client for root endpoint
      const mockRootGet = jest.fn().mockResolvedValue(mockRootResponse);
      jest.spyOn(require('axios'), 'create').mockReturnValue({
        get: mockRootGet,
      });

      // Mock login method to return success
      jest.spyOn(service as any, 'login').mockResolvedValue({ status: 'SUCCESS' });

      // Mock admin API client for tenant details
      const mockApiGet = jest.fn().mockResolvedValueOnce(mockDetailsResponse);

      jest.spyOn(service as any, 'initializeApiClient').mockReturnValue({
        get: mockApiGet,
      });

      // Mock token cache to return tenant-specific tokens
      (service as any).adminApiTokens.get = jest.fn((key: string) => {
        if (key === '1-tenant-one') return 'token-tenant-one';
        return 'mock-token';
      });

      const result = await service.getTenants(environment);

      expect(result[0].odsInstances![0].id).toBeNull();
      expect(result[0].odsInstances![1].id).toBeNull();
    });

    it('should use fallback name "Unknown ODS Instance" for ODS instances with missing names', async () => {
      const environment = mockSbEnvironment as SbEnvironment;

      const mockRootResponse = {
        data: {
          tenancy: {
            multitenantMode: true,
            tenants: ['tenant-one'],
          },
          version: '2.0',
          build: '2.3.2.0',
        },
      };

      const mockDetailsResponse = {
        data: {
          id: 'tenant-one',
          name: 'Tenant One',
          odsInstances: [
            { id: 1, educationOrganizations: [] },
            { id: 2, educationOrganizations: [] },
            { id: 3, educationOrganizations: [] },
          ],
        },
      };

      // Mock axios client for root endpoint
      const mockRootGet = jest.fn().mockResolvedValue(mockRootResponse);
      jest.spyOn(require('axios'), 'create').mockReturnValue({
        get: mockRootGet,
      });

      // Mock login method to return success
      jest.spyOn(service as any, 'login').mockResolvedValue({ status: 'SUCCESS' });

      // Mock admin API client for tenant details
      const mockApiGet = jest.fn().mockResolvedValueOnce(mockDetailsResponse);

      jest.spyOn(service as any, 'initializeApiClient').mockReturnValue({
        get: mockApiGet,
      });

      // Mock token cache to return tenant-specific tokens
      (service as any).adminApiTokens.get = jest.fn((key: string) => {
        if (key === '1-tenant-one') return 'token-tenant-one';
        return 'mock-token';
      });

      const result = await service.getTenants(environment);

      expect(result[0].odsInstances![0].name).toBe('Unknown ODS Instance');
      expect(result[0].odsInstances![1].name).toBe('Unknown ODS Instance');
      expect(result[0].odsInstances![2].name).toBe('Unknown ODS Instance');
    });

    it('should use default tenant when tenancy.tenants array is empty', async () => {
      const environment = mockSbEnvironment as SbEnvironment;

      const mockRootResponse = {
        data: {
          tenancy: {
            multitenantMode: false,
            tenants: [],
          },
          version: '2.0',
          build: '2.3.2.0',
        },
      };

      const mockDefaultTenantDetails = {
        data: {
          id: 'default',
          name: 'Default',
          odsInstances: [],
        },
      };

      // Mock axios client for root endpoint
      const mockRootGet = jest.fn().mockResolvedValue(mockRootResponse);
      jest.spyOn(require('axios'), 'create').mockReturnValue({
        get: mockRootGet,
      });

      // Mock login method to return success
      jest.spyOn(service as any, 'login').mockResolvedValue({ status: 'SUCCESS' });

      // Mock admin API client for tenant details
      const mockApiGet = jest.fn().mockResolvedValueOnce(mockDefaultTenantDetails);

      jest.spyOn(service as any, 'initializeApiClient').mockReturnValue({
        get: mockApiGet,
      });

      // Mock token cache to return tenant-specific tokens
      (service as any).adminApiTokens.get = jest.fn((key: string) => {
        if (key === '1-default') return 'token-default';
        return 'mock-token';
      });

      const result = await service.getTenants(environment);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('default');
    });

    it('should handle authentication by calling login when token is not cached', async () => {
      const environment = mockSbEnvironment as SbEnvironment;

      const mockRootResponse = {
        data: {
          tenancy: {
            multitenantMode: true,
            tenants: ['tenant-one'],
          },
          version: '2.0',
          build: '2.3.2.0',
        },
      };

      const mockDetailsResponse = {
        data: {
          id: 'tenant-one',
          name: 'Tenant One',
          odsInstances: [],
        },
      };

      // Mock axios client for root endpoint
      const mockRootGet = jest.fn().mockResolvedValue(mockRootResponse);
      jest.spyOn(require('axios'), 'create').mockReturnValue({
        get: mockRootGet,
      });

      // Mock token cache to return mock-token for root call, then undefined for tenant call (triggering login)
      let tokenCallCount = 0;
      (service as any).adminApiTokens.get = jest.fn((key: string | number) => {
        tokenCallCount++;
        // First call for root endpoint (uses environment.id as number)
        if (tokenCallCount === 1 && key === 1) return 'mock-token';
        // Second call for tenant authentication - return token after login
        if (key === '1-tenant-one') return 'token-tenant-one';
        return undefined;
      });

      // Mock login method
      const mockLogin = jest.fn().mockResolvedValue({ status: 'SUCCESS' });
      jest.spyOn(service as any, 'login').mockImplementation(mockLogin);

      // Mock admin API client for tenant details
      const mockApiGet = jest.fn().mockResolvedValueOnce(mockDetailsResponse);

      jest.spyOn(service as any, 'initializeApiClient').mockReturnValue({
        get: mockApiGet,
      });

      const result = await service.getTenants(environment);

      expect(mockLogin).toHaveBeenCalledWith(environment, environment.id, 'tenant-one');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('tenant-one');
    });

    it('should populate instanceId and instanceName in education organizations from parent ODS instance', async () => {
      const environment = mockSbEnvironment as SbEnvironment;

      const mockRootResponse = {
        data: {
          tenancy: {
            multitenantMode: true,
            tenants: ['tenant-one'],
          },
          version: '2.0',
          build: '2.3.2.0',
        },
      };

      const mockDetailsResponse = {
        data: {
          id: 'tenant-one',
          name: 'Tenant One',
          odsInstances: [
            {
              id: 999,
              name: 'Test ODS',
              instanceType: 'Production',
              educationOrganizations: [
                {
                  educationOrganizationId: 12345,
                  nameOfInstitution: 'Test School',
                  discriminator: 'edfi.School',
                },
              ],
            },
          ],
        },
      };

      // Mock axios client for root endpoint
      const mockRootGet = jest.fn().mockResolvedValue(mockRootResponse);
      jest.spyOn(require('axios'), 'create').mockReturnValue({
        get: mockRootGet,
      });

      // Mock login method to return success
      jest.spyOn(service as any, 'login').mockResolvedValue({ status: 'SUCCESS' });

      // Mock admin API client for tenant details
      const mockApiGet = jest.fn().mockResolvedValueOnce(mockDetailsResponse);

      jest.spyOn(service as any, 'initializeApiClient').mockReturnValue({
        get: mockApiGet,
      });

      // Mock token cache to return tenant-specific tokens
      (service as any).adminApiTokens.get = jest.fn((key: string) => {
        if (key === '1-tenant-one') return 'token-tenant-one';
        return 'mock-token';
      });

      const result = await service.getTenants(environment);

      expect(result[0].odsInstances![0].edOrgs![0].instanceId).toBe(999);
      expect(result[0].odsInstances![0].edOrgs![0].instanceName).toBe('Test ODS');
    });
  });

  describe('getAllEdOrgsForTenant', () => {
    const mockEdfiTenant = {
      id: 1,
      name: 'test-tenant',
      sbEnvironmentId: 1,
      sbEnvironment: mockSbEnvironment as SbEnvironment,
    } as any;

    it('should successfully fetch all Ed-Orgs for a tenant', async () => {
      // Mock the API response structure: array of ODS instances with nested educationOrganizations
      const mockApiResponse = [
        {
          id: 1,
          name: 'ODS One',
          instanceType: 'Year Specific',
          educationOrganizations: [
            {
              educationOrganizationId: 255901,
              nameOfInstitution: 'School One',
              shortNameOfInstitution: 'S1',
              discriminator: 'edfi.School',
              parentId: null,
            },
          ],
        },
        {
          id: 2,
          name: 'ODS Two',
          instanceType: 'District Specific',
          educationOrganizations: [
            {
              educationOrganizationId: 255902,
              nameOfInstitution: 'School Two',
              shortNameOfInstitution: 'S2',
              discriminator: 'edfi.School',
              parentId: null,
            },
          ],
        },
      ];

      // Expected flattened result with instanceId and instanceName enriched
      const expectedResult = [
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
          instanceId: 2,
          instanceName: 'ODS Two',
          educationOrganizationId: 255902,
          nameOfInstitution: 'School Two',
          shortNameOfInstitution: 'S2',
          discriminator: 'edfi.School',
          parentId: null,
        },
      ];

      // Mock the getAdminApiClient method
      const mockGet = jest.fn().mockResolvedValue(mockApiResponse);
      jest.spyOn(service as any, 'getAdminApiClient').mockReturnValue({
        get: mockGet,
      });

      const result = await service.getAllEdOrgsForTenant(mockEdfiTenant);

      expect(mockGet).toHaveBeenCalledWith('odsInstances/edOrgs');
      expect(result).toEqual(expectedResult);
      expect(result).toHaveLength(2);
      expect(result[0].educationOrganizationId).toBe(255901);
      expect(result[0].instanceId).toBe(1);
      expect(result[0].instanceName).toBe('ODS One');
      expect(result[1].educationOrganizationId).toBe(255902);
      expect(result[1].instanceId).toBe(2);
      expect(result[1].instanceName).toBe('ODS Two');
    });

    it('should return empty array when no Ed-Orgs exist', async () => {
      // Mock the getAdminApiClient method to return empty array
      const mockGet = jest.fn().mockResolvedValue([]);
      jest.spyOn(service as any, 'getAdminApiClient').mockReturnValue({
        get: mockGet,
      });

      const result = await service.getAllEdOrgsForTenant(mockEdfiTenant);

      expect(mockGet).toHaveBeenCalledWith('odsInstances/edOrgs');
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle ODS instances with no educationOrganizations', async () => {
      const mockApiResponse = [
        {
          id: 1,
          name: 'Empty ODS',
          instanceType: 'Year Specific',
          educationOrganizations: [],
        },
        {
          id: 2,
          name: 'ODS Without EdOrgs',
          instanceType: 'District Specific',
          // Missing educationOrganizations property
        },
      ];

      const mockGet = jest.fn().mockResolvedValue(mockApiResponse);
      jest.spyOn(service as any, 'getAdminApiClient').mockReturnValue({
        get: mockGet,
      });

      const result = await service.getAllEdOrgsForTenant(mockEdfiTenant);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle API errors and rethrow them', async () => {
      const apiError = new Error('Admin API connection failed');

      // Mock the getAdminApiClient method to throw an error
      const mockGet = jest.fn().mockRejectedValue(apiError);
      jest.spyOn(service as any, 'getAdminApiClient').mockReturnValue({
        get: mockGet,
      });

      await expect(service.getAllEdOrgsForTenant(mockEdfiTenant)).rejects.toThrow(
        'Admin API connection failed'
      );

      expect(mockGet).toHaveBeenCalledWith('odsInstances/edOrgs');
    });

    it('should log the fetch operation with correct counts', async () => {
      const mockApiResponse = [
        {
          id: 1,
          name: 'ODS One',
          instanceType: 'Year Specific',
          educationOrganizations: [
            {
              educationOrganizationId: 255901,
              nameOfInstitution: 'School One',
              shortNameOfInstitution: 'S1',
              discriminator: 'edfi.School',
              parentId: null,
            },
          ],
        },
      ];

      const logSpy = jest.spyOn(service['logger'], 'log');

      // Mock the getAdminApiClient method
      const mockGet = jest.fn().mockResolvedValue(mockApiResponse);
      jest.spyOn(service as any, 'getAdminApiClient').mockReturnValue({
        get: mockGet,
      });

      await service.getAllEdOrgsForTenant(mockEdfiTenant);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Getting all Ed-Orgs for tenant test-tenant')
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Successfully retrieved 1 Ed-Orgs from 1 ODS instance(s) for tenant test-tenant')
      );
    });
  });

  describe('postInstance', () => {
    it('posts instance payload and returns id from location header', async () => {
      const payload = { name: 'My DB Instance', databaseTemplate: 'Minimal' };
      const mockPost = jest.fn().mockResolvedValue({
        headers: { location: '/v2/odsInstances/manage/123' },
      });
      const getAdminApiClientSpy = jest
        .spyOn(service as any, 'getAdminApiClient')
        .mockReturnValue({ post: mockPost });

      const result = await service.postInstance({ id: 1 } as any, payload as any);

      expect(getAdminApiClientSpy).toHaveBeenCalledWith({ id: 1 }, true);
      expect(mockPost).toHaveBeenCalledWith('odsInstances/manage', payload);
      expect(result).toEqual({ id: 123 });
    });

    it('rethrows error when posting instance fails', async () => {
      const payload = { name: 'My DB Instance', databaseTemplate: 'Minimal' };
      const expectedError = new Error('failed to create');
      const mockPost = jest.fn().mockRejectedValue(expectedError);
      const getAdminApiClientSpy = jest
        .spyOn(service as any, 'getAdminApiClient')
        .mockReturnValue({ post: mockPost });

      await expect(service.postInstance({ id: 1 } as any, payload as any)).rejects.toThrow(
        'failed to create'
      );
      expect(getAdminApiClientSpy).toHaveBeenCalledWith({ id: 1 }, true);
      expect(mockPost).toHaveBeenCalledWith('odsInstances/manage', payload);
    });

    it('throws when Location header is missing or invalid', async () => {
      const payload = { name: 'My DB Instance', databaseTemplate: 'Minimal' };
      const mockPost = jest.fn().mockResolvedValue({
        headers: { location: undefined },
      });
      const getAdminApiClientSpy = jest
        .spyOn(service as any, 'getAdminApiClient')
        .mockReturnValue({ post: mockPost });

      await expect(service.postInstance({ id: 1 } as any, payload as any)).rejects.toThrow(
        'Admin API did not return a Location header containing the created instance id.'
      );
      expect(getAdminApiClientSpy).toHaveBeenCalledWith({ id: 1 }, true);
      expect(mockPost).toHaveBeenCalledWith('odsInstances/manage', payload);
    });
  });

  describe('triggerEdOrgRefresh', () => {
    const env = mockSbEnvironment as SbEnvironment;

    it('should return the jobId when the refresh endpoint succeeds', async () => {
      const mockClient = { post: jest.fn().mockResolvedValue({ jobId: 'job-abc-123' }) };
      const getClientSpy = jest
        .spyOn(service, 'getAdminApiClientForEnvironment')
        .mockReturnValue(mockClient as any);

      const result = await service.triggerEdOrgRefresh(env);

      expect(getClientSpy).toHaveBeenCalledWith(env);
      expect(mockClient.post).toHaveBeenCalledWith('odsInstances/edOrgs/refresh');
      expect(result).toBe('job-abc-123');
    });

    it('should return null and log a warning when the response has no jobId', async () => {
      const mockClient = { post: jest.fn().mockResolvedValue({}) };
      jest.spyOn(service, 'getAdminApiClientForEnvironment').mockReturnValue(mockClient as any);
      const warnSpy = jest.spyOn((service as any).logger, 'warn');

      const result = await service.triggerEdOrgRefresh(env);

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('missing jobId'));
    });

    it('should return null and log a warning when the Admin API call throws', async () => {
      const mockClient = { post: jest.fn().mockRejectedValue(new Error('Network error')) };
      jest.spyOn(service, 'getAdminApiClientForEnvironment').mockReturnValue(mockClient as any);
      const warnSpy = jest.spyOn((service as any).logger, 'warn');

      const result = await service.triggerEdOrgRefresh(env);

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to trigger EdOrg refresh')
      );
    });
  });

  describe('pollJobStatus', () => {
    const env = mockSbEnvironment as SbEnvironment;
    const jobId = 'job-abc-123';

    it('should return "completed" when the job completes on the first poll', async () => {
      const mockClient = { get: jest.fn().mockResolvedValue({ status: 'completed' }) };
      jest.spyOn(service, 'getAdminApiClientForEnvironment').mockReturnValue(mockClient as any);

      const result = await service.pollJobStatus(env, jobId);

      expect(mockClient.get).toHaveBeenCalledWith(`jobs/${jobId}`);
      expect(result).toBe('completed');
    });

    it('should return "completed" after a few "running" responses', async () => {
      const mockClient = {
        get: jest.fn()
          .mockResolvedValueOnce({ status: 'running' })
          .mockResolvedValueOnce({ status: 'running' })
          .mockResolvedValueOnce({ status: 'completed' }),
      };
      jest.spyOn(service, 'getAdminApiClientForEnvironment').mockReturnValue(mockClient as any);

      const result = await service.pollJobStatus(env, jobId);

      expect(mockClient.get).toHaveBeenCalledTimes(3);
      expect(result).toBe('completed');
    });

    it('should return "failed" when the Admin API reports the job failed', async () => {
      const mockClient = { get: jest.fn().mockResolvedValue({ status: 'failed' }) };
      jest.spyOn(service, 'getAdminApiClientForEnvironment').mockReturnValue(mockClient as any);

      const result = await service.pollJobStatus(env, jobId);

      expect(result).toBe('failed');
    });

    it('should return "timeout" after exhausting max poll attempts', async () => {
      // testing.js sets ADMINAPI_REFRESH_POLL_ATTEMPTS to 3, so after 3 "running" responses it times out
      const mockClient = { get: jest.fn().mockResolvedValue({ status: 'running' }) };
      jest.spyOn(service, 'getAdminApiClientForEnvironment').mockReturnValue(mockClient as any);
      const warnSpy = jest.spyOn((service as any).logger, 'warn');

      const result = await service.pollJobStatus(env, jobId);

      expect(mockClient.get).toHaveBeenCalledTimes(3);
      expect(result).toBe('timeout');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('did not complete'));
    });

    it('should return "timeout" and log an error when the poll HTTP call throws', async () => {
      const mockClient = { get: jest.fn().mockRejectedValue(new Error('Connection refused')) };
      jest.spyOn(service, 'getAdminApiClientForEnvironment').mockReturnValue(mockClient as any);
      const errorSpy = jest.spyOn((service as any).logger, 'error');

      const result = await service.pollJobStatus(env, jobId);

      expect(result).toBe('timeout');
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Poll attempt'));
    });
  });
  describe('deleteInstance', () => {
    it('calls admin API DELETE odsInstances/manage/:id and resolves undefined', async () => {
      const instanceManageId = 123;
      const mockDelete = jest.fn().mockResolvedValue(undefined);
      const getAdminApiClientSpy = jest
        .spyOn(service as any, 'getAdminApiClient')
        .mockReturnValue({ delete: mockDelete });

      await expect(service.deleteInstance({ id: 1 } as any, instanceManageId)).resolves.toBeUndefined();

      expect(getAdminApiClientSpy).toHaveBeenCalledWith({ id: 1 }, true);
      expect(mockDelete).toHaveBeenCalledWith(`odsInstances/manage/${instanceManageId}`);
    });

    it('rethrows when admin API delete fails', async () => {
      const instanceManageId = 123;
      const expectedError = new Error('failed to delete');
      const mockDelete = jest.fn().mockRejectedValue(expectedError);
      const getAdminApiClientSpy = jest
        .spyOn(service as any, 'getAdminApiClient')
        .mockReturnValue({ delete: mockDelete });

      await expect(service.deleteInstance({ id: 1 } as any, instanceManageId)).rejects.toThrow(
        'failed to delete'
      );
      expect(getAdminApiClientSpy).toHaveBeenCalledWith({ id: 1 }, true);
      expect(mockDelete).toHaveBeenCalledWith(`odsInstances/manage/${instanceManageId}`);
    });
  });

  describe('getClaimset', () => {
    it.each([
      ['NaN', NaN],
      ['zero', 0],
      ['negative', -5],
      ['non-integer', 1.5],
      ['Infinity', Infinity],
    ])('should reject with a 400 CustomHttpException for a %s claimSetId', async (_desc, claimSetId) => {
      const error: CustomHttpException = await service
        .getClaimset({ id: 1 } as any, claimSetId)
        .then(() => {
          throw new Error('expected getClaimset to reject');
        })
        .catch((e) => e);

      expect(error).toBeInstanceOf(CustomHttpException);
      expect(error.getStatus()).toBe(400);
    });
  });
});
