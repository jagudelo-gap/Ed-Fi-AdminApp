import {
  validateTenantModeCompatibility,
  determineTenantModeFromMetadata,
  determineTenantModeFromOdsMetadata,
  getAdminApiTenantMode,
  determineVersionFromAdminApiMetadata,
  fetchOdsApiMetadata,
  fetchAdminApiInfo,
  validateAdminApiUrl,
} from './api-metadata-utils';
import { ValidationHttpException } from './customExceptions';
import { OdsApiMeta, PostSbEnvironmentDto } from '@edanalytics/models';
import axios from 'axios';

jest.mock('axios');
jest.mock('config', () => ({ EDFI_URLS_TIMEOUT_MS: 5000 }));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('api-metadata-utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateTenantModeCompatibility', () => {
    it('should pass when both APIs are MultiTenant', () => {
      expect(() => {
        validateTenantModeCompatibility('MultiTenant', 'MultiTenant');
      }).not.toThrow();
    });

    it('should pass when both APIs are SingleTenant', () => {
      expect(() => {
        validateTenantModeCompatibility('SingleTenant', 'SingleTenant');
      }).not.toThrow();
    });

    it('should throw error when ODS is MultiTenant but Admin API is SingleTenant', () => {
      expect(() => {
        validateTenantModeCompatibility('MultiTenant', 'SingleTenant');
      }).toThrow(ValidationHttpException);
    });

    it('should throw error when ODS is SingleTenant but Admin API is MultiTenant', () => {
      expect(() => {
        validateTenantModeCompatibility('SingleTenant', 'MultiTenant');
      }).toThrow(ValidationHttpException);
    });

    it('should have proper error message format', () => {
      let error: unknown;
      try {
        validateTenantModeCompatibility('MultiTenant', 'SingleTenant');
      } catch (e) {
        error = e;
      }

      expect(error).toBeInstanceOf(ValidationHttpException);
      // Verify the error message contains the expected tenant mode information
      const typedError = error as ValidationHttpException;
      const errorString = JSON.stringify(typedError.getResponse?.() || typedError.message || '');
      expect(errorString).toContain('Ed-Fi API and Management API URLs');
      expect(errorString).toContain('SingleTenant');
      expect(errorString).toContain('MultiTenant');
    });
  });

  describe('determineTenantModeFromMetadata', () => {
    const mockOdsApiMetaMultiTenant: OdsApiMeta = {
      version: '7.0',
      informationalVersion: '7.0.0',
      suite: 'ODS/API',
      build: '12345',
      apiMode: 'default',
      dataModels: [
        {
          name: 'Ed-Fi',
          version: '3.3.1-b',
          informationalVersion: '3.3.1-b',
        },
      ],
      urls: {
        dependencies: 'https://api.example.com/data/v3.0b/dependencies',
        openApiMetadata: 'https://api.example.com/data/v3.0b/swagger.json',
        oauth: 'https://api.example.com/oauth/authorize',
        dataManagementApi: 'https://api.example.com/data/v3.0b/tenantIdentifier/{id}',
        xsdMetadata: 'https://api.example.com/metadata',
        changeQueries: 'https://api.example.com/data/v3.0b/changeQueries',
        composites: 'https://api.example.com/data/v3.0b/composites',
      },
    };

    const mockOdsApiMetaSingleTenant: OdsApiMeta = {
      version: '7.0',
      informationalVersion: '7.0.0',
      suite: 'ODS/API',
      build: '12345',
      apiMode: 'default',
      dataModels: [
        {
          name: 'Ed-Fi',
          version: '3.3.1-b',
          informationalVersion: '3.3.1-b',
        },
      ],
      urls: {
        dependencies: 'https://api.example.com/data/v3.0b/dependencies',
        openApiMetadata: 'https://api.example.com/data/v3.0b/swagger.json',
        oauth: 'https://api.example.com/oauth/authorize',
        dataManagementApi: 'https://api.example.com/data/v3.0b/',
        xsdMetadata: 'https://api.example.com/metadata',
        changeQueries: 'https://api.example.com/data/v3.0b/changeQueries',
        composites: 'https://api.example.com/data/v3.0b/composites',
      },
    };

    it('should prioritize Admin API multitenantMode field when available (MultiTenant)', () => {
      const adminApiInfo = { tenancy: { multitenantMode: true } };
      const result = determineTenantModeFromMetadata(mockOdsApiMetaSingleTenant, adminApiInfo);
      expect(result).toBe('MultiTenant');
    });

    it('should prioritize Admin API multitenantMode field when available (SingleTenant)', () => {
      const adminApiInfo = { tenancy: { multitenantMode: false } };
      const result = determineTenantModeFromMetadata(mockOdsApiMetaMultiTenant, adminApiInfo);
      expect(result).toBe('SingleTenant');
    });

    it('should fall back to ODS API URL pattern when Admin API info not provided (MultiTenant)', () => {
      const result = determineTenantModeFromMetadata(mockOdsApiMetaMultiTenant);
      expect(result).toBe('MultiTenant');
    });

    it('should fall back to ODS API URL pattern when Admin API info not provided (SingleTenant)', () => {
      const result = determineTenantModeFromMetadata(mockOdsApiMetaSingleTenant);
      expect(result).toBe('SingleTenant');
    });

    it('should fall back to ODS API URL pattern when Admin API info has no tenancy field', () => {
      const adminApiInfo = {};
      const result = determineTenantModeFromMetadata(mockOdsApiMetaMultiTenant, adminApiInfo);
      expect(result).toBe('MultiTenant');
    });

    it('should fall back to ODS API URL pattern when Admin API info has no multitenantMode field', () => {
      const adminApiInfo = { tenancy: {} };
      const result = determineTenantModeFromMetadata(mockOdsApiMetaSingleTenant, adminApiInfo);
      expect(result).toBe('SingleTenant');
    });
  });

  describe('determineTenantModeFromOdsMetadata', () => {
    const mockOdsApiMetaMultiTenant: OdsApiMeta = {
      version: '7.0',
      informationalVersion: '7.0.0',
      suite: 'ODS/API',
      build: '12345',
      apiMode: 'default',
      dataModels: [
        {
          name: 'Ed-Fi',
          version: '3.3.1-b',
          informationalVersion: '3.3.1-b',
        },
      ],
      urls: {
        dependencies: 'https://api.example.com/data/v3.0b/dependencies',
        openApiMetadata: 'https://api.example.com/data/v3.0b/swagger.json',
        oauth: 'https://api.example.com/oauth/authorize',
        dataManagementApi: 'https://api.example.com/data/v3.0b/tenantIdentifier/{id}',
        xsdMetadata: 'https://api.example.com/metadata',
        changeQueries: 'https://api.example.com/data/v3.0b/changeQueries',
        composites: 'https://api.example.com/data/v3.0b/composites',
      },
    };

    const mockOdsApiMetaSingleTenant: OdsApiMeta = {
      version: '7.0',
      informationalVersion: '7.0.0',
      suite: 'ODS/API',
      build: '12345',
      apiMode: 'default',
      dataModels: [
        {
          name: 'Ed-Fi',
          version: '3.3.1-b',
          informationalVersion: '3.3.1-b',
        },
      ],
      urls: {
        dependencies: 'https://api.example.com/data/v3.0b/dependencies',
        openApiMetadata: 'https://api.example.com/data/v3.0b/swagger.json',
        oauth: 'https://api.example.com/oauth/authorize',
        dataManagementApi: 'https://api.example.com/data/v3.0b/',
        xsdMetadata: 'https://api.example.com/metadata',
        changeQueries: 'https://api.example.com/data/v3.0b/changeQueries',
        composites: 'https://api.example.com/data/v3.0b/composites',
      },
    };

    it('should determine MultiTenant mode from ODS metadata URL pattern', () => {
      const result = determineTenantModeFromOdsMetadata(mockOdsApiMetaMultiTenant);
      expect(result).toBe('MultiTenant');
    });

    it('should determine SingleTenant mode from ODS metadata URL pattern', () => {
      const result = determineTenantModeFromOdsMetadata(mockOdsApiMetaSingleTenant);
      expect(result).toBe('SingleTenant');
    });

    it('should throw ValidationHttpException when urls is undefined', () => {
      const metaWithNoUrls = { ...mockOdsApiMetaMultiTenant, urls: undefined } as unknown as OdsApiMeta;
      expect(() => determineTenantModeFromOdsMetadata(metaWithNoUrls)).toThrow(ValidationHttpException);
    });

    it('should throw ValidationHttpException when urls is null', () => {
      const metaWithNullUrls = { ...mockOdsApiMetaMultiTenant, urls: null } as unknown as OdsApiMeta;
      expect(() => determineTenantModeFromOdsMetadata(metaWithNullUrls)).toThrow(ValidationHttpException);
    });
  });

  describe('getAdminApiTenantMode', () => {
    it('should return MultiTenant when multitenantMode is true', () => {
      const adminApiInfo = { tenancy: { multitenantMode: true } };
      const result = getAdminApiTenantMode(adminApiInfo);
      expect(result).toBe('MultiTenant');
    });

    it('should return SingleTenant when multitenantMode is false', () => {
      const adminApiInfo = { tenancy: { multitenantMode: false } };
      const result = getAdminApiTenantMode(adminApiInfo);
      expect(result).toBe('SingleTenant');
    });

    it('should return undefined when multitenantMode is not provided', () => {
      const adminApiInfo = { tenancy: {} };
      const result = getAdminApiTenantMode(adminApiInfo);
      expect(result).toBeUndefined();
    });

    it('should return undefined when tenancy is not provided', () => {
      const adminApiInfo = {};
      const result = getAdminApiTenantMode(adminApiInfo);
      expect(result).toBeUndefined();
    });

    it('should return undefined when adminApiInfo is undefined', () => {
      const result = getAdminApiTenantMode(undefined);
      expect(result).toBeUndefined();
    });

    it('should return undefined when adminApiInfo is null', () => {
      const result = getAdminApiTenantMode(null as unknown as { tenancy?: { multitenantMode?: boolean } });
      expect(result).toBeUndefined();
    });
  });

  describe('determineVersionFromAdminApiMetadata', () => {
    it('should return v1 for Admin API version "1"', () => {
      expect(determineVersionFromAdminApiMetadata('1')).toBe('v1');
    });

    it('should return v2 for Admin API version "2"', () => {
      expect(determineVersionFromAdminApiMetadata('2')).toBe('v2');
    });
    
    it('should return v2 for Admin API version "3" (major >= 2)', () => {
      expect(determineVersionFromAdminApiMetadata('3')).toBe('v2');
    });

    it('should default to v1 for an empty string', () => {
      expect(determineVersionFromAdminApiMetadata('')).toBe('v1');
    });

    it('should default to v1 for a non-numeric version string', () => {
      expect(determineVersionFromAdminApiMetadata('invalid')).toBe('v1');
    });

    it('should default to v1 when input is null', () => {
      expect(determineVersionFromAdminApiMetadata(null as unknown as string)).toBe('v1');
    });
  });

  describe('fetchOdsApiMetadata', () => {
    const dto = { odsApiDiscoveryUrl: 'https://ods-api.example.com' } as PostSbEnvironmentDto;

    it('should return response data on a successful fetch', async () => {
      const mockData: Partial<OdsApiMeta> = { version: '7.2', urls: {} as OdsApiMeta['urls'] };
      mockedAxios.get.mockResolvedValue({ status: 200, data: mockData });

      const result = await fetchOdsApiMetadata(dto);

      expect(result).toEqual(mockData);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        dto.odsApiDiscoveryUrl,
        expect.objectContaining({ headers: { Accept: 'application/json' } })
      );
    });

    it('should throw ValidationHttpException on a non-200 response status', async () => {
      mockedAxios.get.mockResolvedValue({ status: 500, statusText: 'Internal Server Error', data: {} });

      await expect(fetchOdsApiMetadata(dto)).rejects.toThrow(ValidationHttpException);
    });

    it('should throw ValidationHttpException with timeout message on ECONNABORTED error', async () => {
      const timeoutError = new Error('Connection aborted') as Error & { code?: string };
      timeoutError.code = 'ECONNABORTED';
      mockedAxios.get.mockRejectedValue(timeoutError);

      const error = await fetchOdsApiMetadata(dto).catch((e) => e);

      expect(error).toBeInstanceOf(ValidationHttpException);
      const errorString = JSON.stringify(error.getResponse?.() ?? '');
      expect(errorString).toContain('odsApiDiscoveryUrl');
      expect(errorString).toContain('timed out');
    });

    it('should throw ValidationHttpException with timeout message when error message includes "timeout"', async () => {
      mockedAxios.get.mockRejectedValue(new Error('timeout of 5000ms exceeded'));

      const error = await fetchOdsApiMetadata(dto).catch((e) => e);

      expect(error).toBeInstanceOf(ValidationHttpException);
      const errorString = JSON.stringify(error.getResponse?.() ?? '');
      expect(errorString).toContain('timed out');
    });

    it('should throw ValidationHttpException with connection error message on generic network failure', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network Error'));

      const error = await fetchOdsApiMetadata(dto).catch((e) => e);

      expect(error).toBeInstanceOf(ValidationHttpException);
      const errorString = JSON.stringify(error.getResponse?.() ?? '');
      expect(errorString).toContain('odsApiDiscoveryUrl');
      expect(errorString).toContain('Failed to connect');
    });
  });

  describe('fetchAdminApiInfo', () => {
    const adminApiUrl = 'https://admin-api.example.com';

    it('should throw ValidationHttpException when URL is an empty string', async () => {
      await expect(fetchAdminApiInfo('')).rejects.toThrow(ValidationHttpException);
    });

    it('should throw ValidationHttpException when URL is null', async () => {
      await expect(fetchAdminApiInfo(null as unknown as string)).rejects.toThrow(ValidationHttpException);
    });

    it('should return response data on a successful fetch', async () => {
      const mockData = { version: '2.0', specificationVersion: 'v2' };
      mockedAxios.get.mockResolvedValue({ status: 200, data: mockData });

      const result = await fetchAdminApiInfo(adminApiUrl);

      expect(result).toEqual(mockData);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        adminApiUrl,
        expect.objectContaining({ headers: { Accept: 'application/json' } })
      );
    });

    it('should throw ValidationHttpException on a non-200 response status', async () => {
      mockedAxios.get.mockResolvedValue({ status: 401, statusText: 'Unauthorized', data: {} });

      await expect(fetchAdminApiInfo(adminApiUrl)).rejects.toThrow(ValidationHttpException);
    });

    it('should throw ValidationHttpException with timeout message on ECONNABORTED error', async () => {
      const timeoutError = new Error('Connection aborted') as Error & { code?: string };
      timeoutError.code = 'ECONNABORTED';
      mockedAxios.get.mockRejectedValue(timeoutError);

      const error = await fetchAdminApiInfo(adminApiUrl).catch((e) => e);

      expect(error).toBeInstanceOf(ValidationHttpException);
      const errorString = JSON.stringify(error.getResponse?.() ?? '');
      expect(errorString).toContain('adminApiUrl');
      expect(errorString).toContain('timed out');
    });

    it('should throw ValidationHttpException with connection error message on generic network failure', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network Error'));

      const error = await fetchAdminApiInfo(adminApiUrl).catch((e) => e);

      expect(error).toBeInstanceOf(ValidationHttpException);
      const errorString = JSON.stringify(error.getResponse?.() ?? '');
      expect(errorString).toContain('adminApiUrl');
      expect(errorString).toContain('Failed to connect');
    });
  });

  describe('validateAdminApiUrl', () => {
    const adminApiUrl = 'https://admin-api.example.com';
    const odsApiDiscoveryUrl = 'https://ods-api.example.com';

    const makeOdsMeta = (odsVersion: string, multiTenant = false): OdsApiMeta => ({
      version: odsVersion,
      informationalVersion: `${odsVersion}.0`,
      suite: 'ODS/API',
      build: '12345',
      apiMode: 'default',
      dataModels: [{ name: 'Ed-Fi', version: '3.3.1-b', informationalVersion: '3.3.1-b' }],
      urls: {
        dependencies: 'https://ods-api.example.com/dependencies',
        openApiMetadata: 'https://ods-api.example.com/swagger.json',
        oauth: 'https://ods-api.example.com/oauth/authorize',
        dataManagementApi: multiTenant
          ? 'https://ods-api.example.com/data/v3/tenantIdentifier/{id}'
          : 'https://ods-api.example.com/data/v3/',
        xsdMetadata: 'https://ods-api.example.com/metadata',
        changeQueries: 'https://ods-api.example.com/changeQueries',
        composites: 'https://ods-api.example.com/composites',
      },
    });

    const makeAdminMeta = (specVersion: 'v1' | 'v2' | 'v3', multitenantMode?: boolean) => ({
      version: specVersion === 'v1' ? '1.4' : specVersion === 'v2' ? '2.0' : '3.0',
      specificationVersion: specVersion,
      ...(multitenantMode !== undefined ? { tenancy: { multitenantMode } } : {}),
    });

    it('should throw ValidationHttpException when admin metadata has no version', async () => {
      mockedAxios.get.mockResolvedValueOnce({ status: 200, data: {} });

      await expect(validateAdminApiUrl(adminApiUrl, odsApiDiscoveryUrl)).rejects.toThrow(ValidationHttpException);
    });

    it('should throw ValidationHttpException when odsApiDiscoveryUrl is empty', async () => {
      mockedAxios.get.mockResolvedValueOnce({ status: 200, data: makeAdminMeta('v2') });

      await expect(validateAdminApiUrl(adminApiUrl, '')).rejects.toThrow(ValidationHttpException);
    });

    it('should throw ValidationHttpException when ODS metadata has no version', async () => {
      const odsMetaNoVersion = { ...makeOdsMeta('7.0'), version: undefined } as unknown as OdsApiMeta;
      mockedAxios.get
        .mockResolvedValueOnce({ status: 200, data: makeAdminMeta('v2') })
        .mockResolvedValueOnce({ status: 200, data: odsMetaNoVersion });

      await expect(validateAdminApiUrl(adminApiUrl, odsApiDiscoveryUrl)).rejects.toThrow(ValidationHttpException);
    });

    it('should throw ValidationHttpException when ODS version cannot be parsed as a number', async () => {
      const odsMetaBadVersion = { ...makeOdsMeta('7.0'), version: 'not-a-version' };
      mockedAxios.get
        .mockResolvedValueOnce({ status: 200, data: makeAdminMeta('v2') })
        .mockResolvedValueOnce({ status: 200, data: odsMetaBadVersion });

      await expect(validateAdminApiUrl(adminApiUrl, odsApiDiscoveryUrl)).rejects.toThrow(ValidationHttpException);
    });

    // Compatible version combinations: ODS 6.2 + Admin v1
    it('should validate successfully: ODS 6.2 + Admin v1 (SingleTenant)', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({ status: 200, data: makeAdminMeta('v1', false) })
        .mockResolvedValueOnce({ status: 200, data: makeOdsMeta('6.2', false) });

      await expect(validateAdminApiUrl(adminApiUrl, odsApiDiscoveryUrl)).resolves.toBeDefined();
    });

    // Compatible version combinations: ODS 7.x + Admin v2
    it.each(['7.0', '7.1', '7.2', '7.3', '7.4'])(
      'should validate successfully: ODS %s + Admin v2 (SingleTenant)',
      async (odsVersion) => {
        mockedAxios.get
          .mockResolvedValueOnce({ status: 200, data: makeAdminMeta('v2', false) })
          .mockResolvedValueOnce({ status: 200, data: makeOdsMeta(odsVersion, false) });

        await expect(validateAdminApiUrl(adminApiUrl, odsApiDiscoveryUrl)).resolves.toBeDefined();
      }
    );

    // Compatible version combinations: ODS 7.x + Admin v3
    it.each(['7.0', '7.1', '7.2', '7.3', '7.4'])(
      'should validate successfully: ODS %s + Admin v3 (SingleTenant)',
      async (odsVersion) => {
        mockedAxios.get
          .mockResolvedValueOnce({ status: 200, data: makeAdminMeta('v3', false) })
          .mockResolvedValueOnce({ status: 200, data: makeOdsMeta(odsVersion, false) });

        await expect(validateAdminApiUrl(adminApiUrl, odsApiDiscoveryUrl)).resolves.toBeDefined();
      }
    );

    // Incompatible: ODS 7.x + Admin v1
    it.each(['7.0', '7.1', '7.2', '7.3', '7.4'])(
      'should throw ValidationHttpException on version mismatch: ODS %s + Admin v1',
      async (odsVersion) => {
        mockedAxios.get
          .mockResolvedValueOnce({ status: 200, data: makeAdminMeta('v1') })
          .mockResolvedValueOnce({ status: 200, data: makeOdsMeta(odsVersion) });

        await expect(validateAdminApiUrl(adminApiUrl, odsApiDiscoveryUrl)).rejects.toThrow(ValidationHttpException);
      }
    );

    // Incompatible: ODS 6.2 + Admin v2
    it('should throw ValidationHttpException on version mismatch: ODS 6.2 + Admin v2', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({ status: 200, data: makeAdminMeta('v2') })
        .mockResolvedValueOnce({ status: 200, data: makeOdsMeta('6.2') });

      await expect(validateAdminApiUrl(adminApiUrl, odsApiDiscoveryUrl)).rejects.toThrow(ValidationHttpException);
    });

    // Incompatible: ODS 6.2 + Admin v3
    it('should throw ValidationHttpException on version mismatch: ODS 6.2 + Admin v3', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({ status: 200, data: makeAdminMeta('v3') })
        .mockResolvedValueOnce({ status: 200, data: makeOdsMeta('6.2') });

      await expect(validateAdminApiUrl(adminApiUrl, odsApiDiscoveryUrl)).rejects.toThrow(ValidationHttpException);
    });

    // Tenant mode compatibility checks
    it('should validate successfully when Admin API and ODS are both MultiTenant (ODS 7.2 + Admin v2)', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({ status: 200, data: makeAdminMeta('v2', true) })
        .mockResolvedValueOnce({ status: 200, data: makeOdsMeta('7.2', true) });

      await expect(validateAdminApiUrl(adminApiUrl, odsApiDiscoveryUrl)).resolves.toBeDefined();
    });

    it('should throw ValidationHttpException when Admin API is MultiTenant but ODS is SingleTenant', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({ status: 200, data: makeAdminMeta('v2', true) })
        .mockResolvedValueOnce({ status: 200, data: makeOdsMeta('7.2', false) });

      await expect(validateAdminApiUrl(adminApiUrl, odsApiDiscoveryUrl)).rejects.toThrow(ValidationHttpException);
    });

    it('should throw ValidationHttpException when Admin API is SingleTenant but ODS is MultiTenant', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({ status: 200, data: makeAdminMeta('v2', false) })
        .mockResolvedValueOnce({ status: 200, data: makeOdsMeta('7.2', true) });

      await expect(validateAdminApiUrl(adminApiUrl, odsApiDiscoveryUrl)).rejects.toThrow(ValidationHttpException);
    });

    it('should skip tenant mode check when Admin API does not provide multitenantMode (ODS 7.0 + Admin v2)', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({ status: 200, data: makeAdminMeta('v2') })
        .mockResolvedValueOnce({ status: 200, data: makeOdsMeta('7.0', false) });

      await expect(validateAdminApiUrl(adminApiUrl, odsApiDiscoveryUrl)).resolves.toBeDefined();
    });

    it('should return the admin API metadata on a successful validation', async () => {
      const adminMeta = makeAdminMeta('v2', false);
      mockedAxios.get
        .mockResolvedValueOnce({ status: 200, data: adminMeta })
        .mockResolvedValueOnce({ status: 200, data: makeOdsMeta('7.0', false) });

      const result = await validateAdminApiUrl(adminApiUrl, odsApiDiscoveryUrl);

      expect(result).toEqual(adminMeta);
    });

    it('should re-throw ValidationHttpException preserving the original error details', async () => {
      // no version field triggers a ValidationHttpException inside validateAdminApiUrl
      mockedAxios.get.mockResolvedValueOnce({ status: 200, data: {} });

      const error = await validateAdminApiUrl(adminApiUrl, odsApiDiscoveryUrl).catch((e) => e);

      expect(error).toBeInstanceOf(ValidationHttpException);
      const errorString = JSON.stringify(error.getResponse?.() ?? '');
      expect(errorString).toContain('adminApiUrl');
    });
  });
});
