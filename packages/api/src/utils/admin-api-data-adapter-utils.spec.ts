import 'reflect-metadata';
import { SbEnvironment } from '@edanalytics/models-server';
import {
  EdorgType,
  SbEnvironmentConfigPrivate,
  SbEnvironmentConfigPublic,
  TenantDto,
} from '@edanalytics/models';
import { transformTenantData } from './admin-api-data-adapter-utils';

describe('admin-api-data-adapter-utils', () => {
  const mockSbEnvironment: Partial<SbEnvironment> = {
    id: 1,
    name: 'Test Environment',
    adminApiUrl: 'https://api.test.com',
    configPublic: {
      version: 'v1',
      values: {
        edfiHostname: 'test.edfi.org',
        adminApiUrl: 'https://api.test.com',
        adminApiKey: 'test-key',
        adminApiClientDisplayName: 'Test Client',
      },
      adminApiUrl: 'https://api.test.com',
      adminApiVersion: 'v1',
      startingBlocks: false,
    } as unknown as SbEnvironmentConfigPublic,
    configPrivate: {
      adminApiSecret: 'test-secret',
    } as unknown as SbEnvironmentConfigPrivate,
  };

  describe('transformTenantData', () => {
    it('should transform complete tenant data with all fields present', () => {
      const apiTenant: TenantDto = {
        id: 'tenant-1',
        name: 'Test Tenant',
        odsInstances: [
          {
            id: 100,
            name: 'ODS Instance 1',
            instanceManageId: 42,
            instanceType: 'Production',
            edOrgs: [
              {
                instanceId: 100,
                instanceName: 'ODS Instance 1',
                educationOrganizationId: 255901,
                nameOfInstitution: 'Grand Bend High School',
                shortNameOfInstitution: 'GBHS',
                discriminator: 'edfi.School' as EdorgType,
                parentId: 255900,
              },
            ],
          },
        ],
      };

      const environment = mockSbEnvironment as SbEnvironment;
      const result = transformTenantData(apiTenant, environment);

      expect(result).toHaveProperty('name', 'Test Tenant');
      expect(result).toHaveProperty('sbEnvironmentId', 1);
      expect(result).toHaveProperty('created');
      expect(result.created).toBeInstanceOf(Date);
      expect(result.odss).toHaveLength(1);

      const ods = result.odss![0];
      expect(ods).toMatchObject({
        id: 0,
        odsInstanceId: 100,
        odsInstanceName: 'ODS Instance 1',
        instanceManageId: 42,
        edfiTenantId: 0,
        sbEnvironmentId: 1,
      });
      expect(ods.ownerships).toEqual([]);
      expect(ods.edorgs).toHaveLength(1);

      const edorg = ods.edorgs![0];
      expect(edorg).toMatchObject({
        odsInstanceId: 100,
        educationOrganizationId: 255901,
        nameOfInstitution: 'Grand Bend High School',
        shortNameOfInstitution: 'GBHS',
        discriminator: 'edfi.School',
        parentId: 255900,
      });
    });

    it('should handle tenant with multiple ODS instances', () => {
      const apiTenant: TenantDto = {
        id: 'tenant-multi',
        name: 'Multi-ODS Tenant',
        odsInstances: [
          {
            id: 1,
            name: 'Production ODS',
            instanceType: 'Production',
            edOrgs: [],
          },
          {
            id: 2,
            name: 'Test ODS',
            instanceType: 'Test',
            edOrgs: [],
          },
          {
            id: 3,
            name: 'Development ODS',
            instanceType: 'Development',
            edOrgs: [],
          },
        ],
      };

      const environment = mockSbEnvironment as SbEnvironment;
      const result = transformTenantData(apiTenant, environment);

      expect(result.odss).toHaveLength(3);
      expect(result.odss![0].odsInstanceId).toBe(1);
      expect(result.odss![0].odsInstanceName).toBe('Production ODS');
      expect(result.odss![1].odsInstanceId).toBe(2);
      expect(result.odss![1].odsInstanceName).toBe('Test ODS');
      expect(result.odss![2].odsInstanceId).toBe(3);
      expect(result.odss![2].odsInstanceName).toBe('Development ODS');
    });

    it('should handle ODS instance with multiple education organizations', () => {
      const apiTenant: TenantDto = {
        id: 'tenant-multi-edorg',
        name: 'Multi-EdOrg Tenant',
        odsInstances: [
          {
            id: 100,
            name: 'District ODS',
            instanceType: 'Production',
            edOrgs: [
              {
                instanceId: 100,
                instanceName: 'District ODS',
                educationOrganizationId: 255900,
                nameOfInstitution: 'Grand Bend ISD',
                shortNameOfInstitution: 'GBISD',
                discriminator: 'edfi.LocalEducationAgency' as EdorgType,
                parentId: null,
              },
              {
                instanceId: 100,
                instanceName: 'District ODS',
                educationOrganizationId: 255901,
                nameOfInstitution: 'Grand Bend High School',
                shortNameOfInstitution: 'GBHS',
                discriminator: 'edfi.School' as EdorgType,
                parentId: 255900,
              },
              {
                instanceId: 100,
                instanceName: 'District ODS',
                educationOrganizationId: 255902,
                nameOfInstitution: 'Grand Bend Middle School',
                discriminator: 'edfi.School' as EdorgType,
                parentId: 255900,
              },
            ],
          },
        ],
      };

      const environment = mockSbEnvironment as SbEnvironment;
      const result = transformTenantData(apiTenant, environment);

      expect(result.odss![0].edorgs).toHaveLength(3);
      expect(result.odss![0].edorgs![0]).toMatchObject({
        educationOrganizationId: 255900,
        nameOfInstitution: 'Grand Bend ISD',
        discriminator: 'edfi.LocalEducationAgency',
        parentId: null,
      });
      expect(result.odss![0].edorgs![1]).toMatchObject({
        educationOrganizationId: 255901,
        nameOfInstitution: 'Grand Bend High School',
        discriminator: 'edfi.School',
        parentId: 255900,
      });
      expect(result.odss![0].edorgs![2]).toMatchObject({
        educationOrganizationId: 255902,
        nameOfInstitution: 'Grand Bend Middle School',
        discriminator: 'edfi.School',
      });
    });

    it('should handle tenant with no ODS instances', () => {
      const apiTenant: TenantDto = {
        id: 'tenant-no-ods',
        name: 'Empty Tenant',
        odsInstances: undefined,
      };

      const environment = mockSbEnvironment as SbEnvironment;
      const result = transformTenantData(apiTenant, environment);

      expect(result.name).toBe('Empty Tenant');
      expect(result.odss).toEqual([]);
    });

    it('should handle tenant with empty ODS instances array', () => {
      const apiTenant: TenantDto = {
        id: 'tenant-empty-ods',
        name: 'Empty ODS Tenant',
        odsInstances: [],
      };

      const environment = mockSbEnvironment as SbEnvironment;
      const result = transformTenantData(apiTenant, environment);

      expect(result.odss).toEqual([]);
    });

    it('should handle ODS instance with no edOrgs', () => {
      const apiTenant: TenantDto = {
        id: 'tenant-no-edorgs',
        name: 'No EdOrgs Tenant',
        odsInstances: [
          {
            id: 1,
            name: 'Empty ODS',
            instanceType: 'Production',
            edOrgs: undefined,
          },
        ],
      };

      const environment = mockSbEnvironment as SbEnvironment;
      const result = transformTenantData(apiTenant, environment);

      expect(result.odss).toHaveLength(1);
      expect(result.odss![0].edorgs).toEqual([]);
    });

    it('should handle ODS instance with empty edOrgs array', () => {
      const apiTenant: TenantDto = {
        id: 'tenant-empty-edorgs',
        name: 'Empty EdOrgs Tenant',
        odsInstances: [
          {
            id: 1,
            name: 'Empty ODS',
            instanceType: 'Production',
            edOrgs: [],
          },
        ],
      };

      const environment = mockSbEnvironment as SbEnvironment;
      const result = transformTenantData(apiTenant, environment);

      expect(result.odss![0].edorgs).toEqual([]);
    });

    it('should set shortNameOfInstitution to null when not provided', () => {
      const apiTenant: TenantDto = {
        id: 'tenant-no-short-name',
        name: 'Test Tenant',
        odsInstances: [
          {
            id: 1,
            name: 'ODS 1',
            instanceType: 'Production',
            edOrgs: [
              {
                instanceId: 1,
                instanceName: 'ODS 1',
                educationOrganizationId: 255901,
                nameOfInstitution: 'Test School',
                shortNameOfInstitution: undefined,
                discriminator: 'edfi.School' as EdorgType,
                parentId: null,
              },
            ],
          },
        ],
      };

      const environment = mockSbEnvironment as SbEnvironment;
      const result = transformTenantData(apiTenant, environment);

      expect(result.odss![0].edorgs![0].shortNameOfInstitution).toBeNull();
    });

    it('should preserve shortNameOfInstitution when provided', () => {
      const apiTenant: TenantDto = {
        id: 'tenant-with-short-name',
        name: 'Test Tenant',
        odsInstances: [
          {
            id: 1,
            name: 'ODS 1',
            instanceType: 'Production',
            edOrgs: [
              {
                instanceId: 1,
                instanceName: 'ODS 1',
                educationOrganizationId: 255901,
                nameOfInstitution: 'Test School',
                shortNameOfInstitution: 'TS',
                discriminator: 'edfi.School' as EdorgType,
                parentId: null,
              },
            ],
          },
        ],
      };

      const environment = mockSbEnvironment as SbEnvironment;
      const result = transformTenantData(apiTenant, environment);

      expect(result.odss![0].edorgs![0].shortNameOfInstitution).toBe('TS');
    });

    it('should set created date to current date', () => {
      const beforeDate = new Date();
      
      const apiTenant: TenantDto = {
        id: 'tenant-date',
        name: 'Date Test Tenant',
        odsInstances: [],
      };

      const environment = mockSbEnvironment as SbEnvironment;
      const result = transformTenantData(apiTenant, environment);

      const afterDate = new Date();
      
      expect(result.created).toBeInstanceOf(Date);
      expect(result.created!.getTime()).toBeGreaterThanOrEqual(beforeDate.getTime());
      expect(result.created!.getTime()).toBeLessThanOrEqual(afterDate.getTime());
    });

    it('should set default ODS properties correctly', () => {
      const apiTenant: TenantDto = {
        id: 'tenant-defaults',
        name: 'Defaults Test',
        odsInstances: [
          {
            id: 123,
            name: 'Test ODS',
            instanceType: 'Production',
            edOrgs: [],
          },
        ],
      };

      const environment = mockSbEnvironment as SbEnvironment;
      const result = transformTenantData(apiTenant, environment);

      const ods = result.odss![0];
      expect(ods.id).toBe(0);
      expect(ods.edfiTenantId).toBe(0);
      expect(ods.ownerships).toEqual([]);
      expect(ods.sbEnvironmentId).toBe(environment.id);
    });

    it('should correctly map discriminator types', () => {
      const apiTenant: TenantDto = {
        id: 'tenant-discriminator',
        name: 'Discriminator Test',
        odsInstances: [
          {
            id: 1,
            name: 'ODS 1',
            instanceType: 'Production',
            edOrgs: [
              {
                instanceId: 1,
                instanceName: 'ODS 1',
                educationOrganizationId: 1,
                nameOfInstitution: 'LEA',
                discriminator: 'edfi.LocalEducationAgency' as EdorgType,
                parentId: null,
              },
              {
                instanceId: 1,
                instanceName: 'ODS 1',
                educationOrganizationId: 2,
                nameOfInstitution: 'School',
                discriminator: 'edfi.School' as EdorgType,
                parentId: 1,
              },
              {
                instanceId: 1,
                instanceName: 'ODS 1',
                educationOrganizationId: 3,
                nameOfInstitution: 'SEA',
                discriminator: 'edfi.StateEducationAgency' as EdorgType,
                parentId: null,
              },
            ],
          },
        ],
      };

      const environment = mockSbEnvironment as SbEnvironment;
      const result = transformTenantData(apiTenant, environment);

      expect(result.odss![0].edorgs![0].discriminator).toBe('edfi.LocalEducationAgency');
      expect(result.odss![0].edorgs![1].discriminator).toBe('edfi.School');
      expect(result.odss![0].edorgs![2].discriminator).toBe('edfi.StateEducationAgency');
    });

    it('should use sbEnvironmentId from provided environment', () => {
      const customEnvironment: Partial<SbEnvironment> = {
        ...mockSbEnvironment,
        id: 999,
      };

      const apiTenant: TenantDto = {
        id: 'tenant-env-id',
        name: 'Env ID Test',
        odsInstances: [
          {
            id: 1,
            name: 'ODS 1',
            instanceType: 'Production',
            edOrgs: [],
          },
        ],
      };

      const result = transformTenantData(apiTenant, customEnvironment as SbEnvironment);

      expect(result.sbEnvironmentId).toBe(999);
      expect(result.odss![0].sbEnvironmentId).toBe(999);
    });

    it('should handle parentId being null', () => {
      const apiTenant: TenantDto = {
        id: 'tenant-null-parent',
        name: 'Null Parent Test',
        odsInstances: [
          {
            id: 1,
            name: 'ODS 1',
            instanceType: 'Production',
            edOrgs: [
              {
                instanceId: 1,
                instanceName: 'ODS 1',
                educationOrganizationId: 255900,
                nameOfInstitution: 'Root Organization',
                discriminator: 'edfi.StateEducationAgency' as EdorgType,
                parentId: null,
              },
            ],
          },
        ],
      };

      const environment = mockSbEnvironment as SbEnvironment;
      const result = transformTenantData(apiTenant, environment);

      expect(result.odss![0].edorgs![0].parentId).toBeNull();
    });

    it('should return Partial<EdfiTenant> with correct structure', () => {
      const apiTenant: TenantDto = {
        id: 'tenant-structure',
        name: 'Structure Test',
        odsInstances: [],
      };

      const environment = mockSbEnvironment as SbEnvironment;
      const result = transformTenantData(apiTenant, environment);

      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('sbEnvironmentId');
      expect(result).toHaveProperty('created');
      expect(result).toHaveProperty('odss');
      expect(typeof result.name).toBe('string');
      expect(typeof result.sbEnvironmentId).toBe('number');
      expect(result.created).toBeInstanceOf(Date);
      expect(Array.isArray(result.odss)).toBe(true);
    });
  });
});
