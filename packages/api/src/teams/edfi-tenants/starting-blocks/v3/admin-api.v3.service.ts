import {
  ClaimsetMultipleWireDtoV3,
  ClaimsetSingleWireDtoV3,
  CopyClaimsetDtoV3,
  EducationOrganizationDto,
  GetApiClientDtoV3,
  GetApplicationDtoV3,
  GetDataStoreSummaryDtoV3,
  GetProfileDtoV3,
  GetVendorDtoV3,
  ISbEnvironmentConfigPrivateV2,
  Id,
  ImportClaimsetSingleDtoV3,
  OdsInstanceDto,
  PostApiClientDtoV3,
  PostApiClientResponseDtoV3,
  PostApplicationDtoV3,
  PostApplicationResponseDtoV3,
  PostClaimsetDtoV3,
  PostInstanceDtoV3,
  PostProfileDtoV3,
  PostVendorDtoV3,
  PutApiClientDtoV3,
  PutApplicationDtoV3,
  PutClaimsetDtoV3,
  PutProfileDtoV3,
  PutVendorDtoV3,
  TenantDto,
  toGetApiClientDtoV3,
  toGetApplicationDtoV3,
  toGetClaimsetMultipleDtoV3,
  toGetClaimsetSingleDtoV3,
  toGetDataStoreSummaryDtoV3,
  toGetProfileDtoV3,
  toGetVendorDtoV3,
  toPostApiClientResponseDtoV3,
  toPostApplicationResponseDtoV3,
} from '@edanalytics/models';
import { EdfiTenant, SbEnvironment } from '@edanalytics/models-server';
import { Injectable, Logger } from '@nestjs/common';
import axios, { isAxiosError } from 'axios';
import NodeCache from 'node-cache';
import { CustomHttpException } from '../../../../utils';
import { adminApiLoginStatusMsgs } from '../../adminApiLoginFailureMsgs';
import {
  pollJobStatus,
  triggerEdOrgRefresh,
} from '../admin-api-refresh-poll.util';

/**
 * Response shape of the Admin API root endpoint (`GET /`), used to determine
 * whether the environment is running in multi-tenant mode.
 */
interface TenancyResponse {
  tenancy?: {
    multitenantMode?: boolean;
    tenants?: string[];
  };
}

/**
 * A single education organization as returned by the Admin API's
 * `dataStores/edOrgs`-family endpoints (raw shape, not yet mapped to EducationOrganizationDto).
 */
interface AdminApiEducationOrganization {
  educationOrganizationId: number;
  nameOfInstitution: string;
  shortNameOfInstitution?: string | null;
  discriminator: string;
  parentId?: number | null;
}

/**
 * A single data store as returned by the Admin API's `dataStores/edOrgs`-family
 * endpoints (raw shape, not yet mapped to OdsInstanceDto).
 */
interface AdminApiDataStore {
  id: number | null;
  name: string;
  dataStoreManageId?: number | null;
  dataStoreType?: string | null;
  instanceType?: string | null;
  status?: string | null;
  databaseTemplate?: string | null;
  databaseName?: string | null;
  educationOrganizations?: AdminApiEducationOrganization[];
}

/**
 * Response shape of `tenants/{tenantName}/dataStores/edOrgs`.
 */
interface TenantDataStoresEdOrgsResponse {
  dataStores?: AdminApiDataStore[];
}

/**
 * This service is used to interact with the Admin API V3. Each method is a
 * single API call (plus login if token is expired).
 *
 * Each call uses the `getAdminApiClient` method, which throws explicit HTTP
 * 500s and doesn't leak any internal exceptions. So any Axios errors (e.g.
 * 404) or other non-Nest exceptions encountered externally can be assumed
 * to have arisen in the actual call of interest.
 *
 * `ISbEnvironmentConfigPrivateV2` is intentionally reused here (not
 * duplicated as a "V3" type) — the private credential-storage shape
 * (`{ tenants: Record<string, { adminApiSecret }> }`) is identical between
 * V2 and V3 environments.
 */
@Injectable()
export class AdminApiServiceV3 {
  private adminApiTokens: NodeCache;
  private readonly logger = new Logger(AdminApiServiceV3.name);

  constructor() {
    this.adminApiTokens = new NodeCache({ checkperiod: 60 });
  }

  /**
   * Generate a composite token key for tenant-specific authentication
   * This ensures each tenant has its own token in the cache
   */
  private getTenantTokenKey(environmentId: number, tenantName: string): string {
    return `${environmentId}-${tenantName}`;
  }

  async login(sbEnvironment: SbEnvironment, id: number, tenantName?: string) {
    const configPublic = sbEnvironment.configPublic;
    const configPrivate = sbEnvironment.configPrivate;
    const v3Config =
      'version' in configPublic && configPublic.version === 'v3' ? configPublic.values : undefined;
    const v3ConfigPrivate =
      'version' in configPublic && configPublic.version === 'v3'
        ? (configPrivate as ISbEnvironmentConfigPrivateV2)
        : undefined;

    if (!v3Config || !v3ConfigPrivate) {
      return {
        status: 'NO_CONFIG' as const,
      };
    }

    // If no tenant name provided, try to find the first available tenant credentials
    // This is needed for initial tenant discovery in EdFi environments
    if (!tenantName) {
      const availableTenants = v3Config.tenants ? Object.keys(v3Config.tenants) : [];

      if (availableTenants.length === 0) {
        return {
          status: 'NO_TENANT_CONFIG' as const,
        };
      }

      // Prefer 'default' tenant if available, otherwise use first tenant
      tenantName = availableTenants.includes('default') ? 'default' : availableTenants[0];

      this.logger.log(`No tenant specified for login, using tenant: ${tenantName}`);
    }

    if (!v3Config?.tenants[tenantName] || !v3ConfigPrivate?.tenants[tenantName]) {
      return {
        status: 'NO_TENANT_CONFIG' as const,
      };
    }
    const adminApiUrl = sbEnvironment.adminApiUrl;
    const adminApiKey = v3Config?.tenants[tenantName]?.adminApiKey;
    const adminApiSecret = v3ConfigPrivate?.tenants[tenantName]?.adminApiSecret;

    if (typeof adminApiUrl !== 'string') {
      return {
        status: 'NO_ADMIN_API_URL' as const,
      };
    }
    if (typeof adminApiKey !== 'string') {
      return {
        status: 'NO_ADMIN_API_KEY' as const,
      };
    }
    if (typeof adminApiSecret !== 'string') {
      return {
        status: 'NO_ADMIN_API_SECRET' as const,
      };
    }
    let accessTokenUri: string;
    try {
      const url = new URL(adminApiUrl);
      url.pathname = url.pathname.replace(/\/$/, '') + '/connect/token';
      accessTokenUri = url.toString();
    } catch (InvalidUrl) {
      this.logger.log(InvalidUrl);
      return {
        status: 'NO_ADMIN_API_URL' as const,
      };
    }

    const reqBody = new URLSearchParams();
    reqBody.set('client_id', adminApiKey);
    reqBody.set('client_secret', adminApiSecret);
    reqBody.set('grant_type', 'client_credentials');
    reqBody.set('scope', 'edfi_admin_api/full_access');

    const options = {
      method: 'POST',
      url: accessTokenUri,
      headers: {
        Accept: 'application/json',
        tenant: tenantName,
      },
      data: reqBody,
    };

    try {
      await axios.request(options).then((v) => {
        // Store token with tenant-specific composite key
        const tokenKey = this.getTenantTokenKey(id, tenantName);
        this.adminApiTokens.set(tokenKey, v.data.access_token, Number(v.data.expires_in) - 60);
        // Also store an environment-level alias for callers that don't have a tenant context (e.g. tenancy discovery)
        this.adminApiTokens.set(id, v.data.access_token, Number(v.data.expires_in) - 60);
        this.logger.log(
          `Stored token for environment ${id} tenant ${tenantName} at key: ${tokenKey}`,
        );
      });
      return {
        status: 'SUCCESS' as const,
      };
    } catch (LoginFailed) {
      if (LoginFailed?.code === 'ERR_HTTP2_GOAWAY_SESSION') {
        return {
          status: 'GOAWAY' as const, // TBD what to do about this
        };
      } else if (isAxiosError(LoginFailed) && LoginFailed.response?.status === 404) {
        return {
          status: 'TOKEN_URI_NOT_FOUND' as const,
        };
      } else if (isAxiosError(LoginFailed) && LoginFailed.response?.status === 401) {
        return {
          status: 'INVALID_CREDS' as const,
        };
      }
      this.logger.warn(LoginFailed);
      this.logger.log({
        accessTokenUri: accessTokenUri,
        adminApiKey: adminApiKey?.length,
        adminApiSecret: adminApiSecret?.length,
      });
      return {
        status: 'LOGIN_FAILED' as const,
      };
    }
  }

  /**
   * Get an authenticated API client for a specific tenant.
   *
   * @param edfiTenant - The tenant to get the client for
   * @param notJustData - Whether to return full response or just data
   * @returns Axios instance configured with tenant authentication
   */
  public getAdminApiClient(edfiTenant: EdfiTenant, notJustData?: boolean) {
    const client = this.initializeApiClient(edfiTenant.sbEnvironment, notJustData);
    client.interceptors.request.use(async (config) => {
      // Use composite key for tenant-specific token retrieval
      const tokenKey = this.getTenantTokenKey(edfiTenant.sbEnvironment.id, edfiTenant.name);
      let token: undefined | string = this.adminApiTokens.get(tokenKey);
      if (token === undefined) {
        this.logger.log(`No cached token found for tenant ${edfiTenant.name}, attempting login...`);
        const adminLogin = await this.login(
          edfiTenant.sbEnvironment,
          edfiTenant.sbEnvironment.id,
          edfiTenant.name,
        );

        if (adminLogin.status !== 'SUCCESS') {
          const errorMsg = adminApiLoginStatusMsgs[adminLogin.status];
          this.logger.error(
            `Authentication failed for tenant ${edfiTenant.name}: ${adminLogin.status} - ${errorMsg}`,
          );
          throw new CustomHttpException(
            {
              title: `Authentication failed for tenant ${edfiTenant.name}`,
              type: 'Error',
              message: `${adminLogin.status}: ${errorMsg}`,
            },
            500,
          );
        }
        token = this.adminApiTokens.get(tokenKey);
        this.logger.log(`Successfully authenticated tenant ${edfiTenant.name}`);
      }
      config.headers.Authorization = `Bearer ${token}`;
      config.headers.tenant = edfiTenant.name;
      return config;
    });
    return client;
  }

  private initializeApiClient(environment: SbEnvironment, notJustData: boolean) {
    const client = axios.create({
      baseURL: environment.adminApiUrl.replace(/\/$/, '') + '/v3/',
    });
    client.interceptors.response.use(
      notJustData
        ? (value) => value
        : (value) => {
            return value.data;
          },
      (err) => {
        this.logger.error(`Unable to create client on ${environment.adminApiUrl}: ${err}`);
        throw err;
      },
    );
    return client;
  }

   /**
   * Get an authenticated API client for a specific environment.
   * For multi-tenant environments, uses the first available tenant's credentials
   * and includes the tenant header so environment-level endpoints (e.g. EdOrg refresh,
   * job status polling) are accepted by the Admin API.
   *
   * @param sbEnvironment - The Starting Blocks environment to authenticate against
   * @returns Axios instance configured with environment-level authentication
   */
  public getAdminApiClientForEnvironment(sbEnvironment: SbEnvironment) {
    const configPublic = sbEnvironment.configPublic;
    const v3Config =
      'version' in configPublic && configPublic.version === 'v3' ? configPublic.values : undefined;
    const availableTenants = v3Config?.tenants ? Object.keys(v3Config.tenants) : [];
    const tenantName =
      availableTenants.length > 0
        ? availableTenants.includes('default')
          ? 'default'
          : availableTenants[0]
        : undefined;
    return this.getAdminApiClientUsingEnv(sbEnvironment, undefined, tenantName);
  }

  private getAdminApiClientUsingEnv(environment: SbEnvironment, notJustData?: boolean, tenantName?: string) {
    const client = this.initializeApiClient(environment, notJustData);
    client.interceptors.request.use(async (config) => {
      const tokenKey = tenantName
        ? this.getTenantTokenKey(environment.id, tenantName)
        : environment.id;
      let token: undefined | string = this.adminApiTokens.get(tokenKey);
      if (token === undefined) {
        const adminLogin = await this.login(environment, environment.id, tenantName);

        if (adminLogin.status !== 'SUCCESS') {
          throw new CustomHttpException(
            {
              title: adminApiLoginStatusMsgs[adminLogin.status],
              type: 'Error',
            },
            500
          );
        }
        token = this.adminApiTokens.get(tokenKey);
      }
      config.headers.Authorization = `Bearer ${token}`;
      if (tenantName) {
        config.headers.tenant = tenantName;
      }
      return config;
    });
    return client;
  }

  //
  // Applications
  //

  async getApplications(edfiTenant: EdfiTenant) {
    return toGetApplicationDtoV3(
      await this.getAdminApiClient(edfiTenant)
        .get<GetApplicationDtoV3[], GetApplicationDtoV3[]>(`applications?offset=0&limit=10000`)
        .catch((err) => {
          this.logger.error(`Error getting applications for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        }),
    );
  }

  async postApplication(edfiTenant: EdfiTenant, application: PostApplicationDtoV3) {
    return toPostApplicationResponseDtoV3(
      await this.getAdminApiClient(edfiTenant)
        .post<PostApplicationResponseDtoV3, PostApplicationResponseDtoV3>(
          `applications`,
          application,
        )
        .catch((err) => {
          this.logger.error(`Error creating application for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        }),
    );
  }

  async getApplication(edfiTenant: EdfiTenant, applicationId: number) {
    return toGetApplicationDtoV3(
      await this.getAdminApiClient(edfiTenant)
        .get<GetApplicationDtoV3, GetApplicationDtoV3>(`applications/${applicationId}`)
        .catch((err) => {
          this.logger.error(
            `Error getting application ${applicationId} for tenant ${edfiTenant.id}: ${err}`,
          );
          throw err;
        }),
    );
  }

  async putApplication(
    edfiTenant: EdfiTenant,
    applicationId: number,
    application: PutApplicationDtoV3,
  ) {
    return toGetApplicationDtoV3(
      await this.getAdminApiClient(edfiTenant)
        .put<GetApplicationDtoV3, GetApplicationDtoV3>(
          `applications/${applicationId}`,
          application,
        )
        .catch((err) => {
          this.logger.error(
            `Error updating application ${applicationId} for tenant ${edfiTenant.id}: ${err}`,
          );
          throw err;
        }),
    );
  }

  async deleteApplication(edfiTenant: EdfiTenant, applicationId: number) {
    await this.getAdminApiClient(edfiTenant)
      .delete(`applications/${applicationId}`)
      .catch((err) => {
        this.logger.error(
          `Error deleting application ${applicationId} for tenant ${edfiTenant.id}: ${err}`,
        );
        throw err;
      });
    return undefined;
  }

  //
  // Api Clients
  //

  async getApiClients(edfiTenant: EdfiTenant, applicationId: number) {
    return toGetApiClientDtoV3(
      await this.getAdminApiClient(edfiTenant)
        .get<GetApiClientDtoV3[], GetApiClientDtoV3[]>(
          `apiclients?offset=0&limit=10000&applicationId=${applicationId}`,
        )
        .catch((err) => {
          this.logger.error(`Error getting API clients for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        }),
    );
  }

  async getApiClient(edfiTenant: EdfiTenant, apiClientId: number) {
    return toGetApiClientDtoV3(
      await this.getAdminApiClient(edfiTenant)
        .get<GetApiClientDtoV3, GetApiClientDtoV3>(`apiclients/${apiClientId}`)
        .catch((err) => {
          this.logger.error(
            `Error getting API client ${apiClientId} for tenant ${edfiTenant.id}: ${err}`,
          );
          throw err;
        }),
    );
  }

  async putApiClient(edfiTenant: EdfiTenant, apiClientId: number, apiClient: PutApiClientDtoV3) {
    return toGetApiClientDtoV3(
      await this.getAdminApiClient(edfiTenant)
        .put<GetApiClientDtoV3, GetApiClientDtoV3>(`apiclients/${apiClientId}`, apiClient)
        .catch((err) => {
          this.logger.error(
            `Error updating API client ${apiClientId} for tenant ${edfiTenant.id}: ${err}`,
          );
          throw err;
        }),
    );
  }

  async postApiClient(
    edfiTenant: EdfiTenant,
    apiClient: PostApiClientDtoV3,
  ): Promise<PostApiClientResponseDtoV3> {
    return toPostApiClientResponseDtoV3(
      await this.getAdminApiClient(edfiTenant)
        .post<PostApiClientResponseDtoV3, PostApiClientResponseDtoV3>(`apiclients`, apiClient)
        .catch((err) => {
          this.logger.error(`Error creating API client for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        }),
    );
  }

  async putApiClientResetCredential(edfiTenant: EdfiTenant, apiClientId: number) {
    return toPostApiClientResponseDtoV3(
      await this.getAdminApiClient(edfiTenant)
        .put<PostApiClientResponseDtoV3, PostApiClientResponseDtoV3>(
          `apiclients/${apiClientId}/reset-credential`,
        )
        .catch((err) => {
          this.logger.error(
            `Error resetting API client credential for API client ${apiClientId} for tenant ${edfiTenant.id}: ${err}`,
          );
          throw err;
        }),
    );
  }

  async deleteApiClient(edfiTenant: EdfiTenant, apiClientId: number) {
    await this.getAdminApiClient(edfiTenant)
      .delete(`apiclients/${apiClientId}`)
      .catch((err) => {
        this.logger.error(
          `Error deleting API client ${apiClientId} for tenant ${edfiTenant.id}: ${err}`,
        );
        throw err;
      });
    return undefined;
  }

  //
  // Claimsets
  //

  async getClaimsets(edfiTenant: EdfiTenant) {
    return toGetClaimsetMultipleDtoV3(
      await this.getAdminApiClient(edfiTenant)
        .get<ClaimsetMultipleWireDtoV3[], ClaimsetMultipleWireDtoV3[]>(
          `claimSets?offset=0&limit=10000`,
        )
        .catch((err) => {
          this.logger.error(`Error getting claimsets for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        }),
    );
  }

  async postClaimset(edfiTenant: EdfiTenant, claimSet: PostClaimsetDtoV3) {
    return toGetClaimsetSingleDtoV3(
      await this.getAdminApiClient(edfiTenant)
        .post<ClaimsetSingleWireDtoV3, ClaimsetSingleWireDtoV3>(`claimSets`, claimSet)
        .catch((err) => {
          this.logger.error(`Error creating claimset for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        }),
    );
  }

  async getClaimset(edfiTenant: EdfiTenant, claimSetId: number) {
    const safeClaimSetId = this.sanitizeClaimSetId(claimSetId);
    return toGetClaimsetSingleDtoV3(
      await this.getAdminApiClient(edfiTenant)
        // sanitizeClaimSetId already guarantees a positive integer (throws
        // otherwise), so path-traversal/host-redirect via this segment is not
        // actually reachable; encodeURIComponent is added on top so static
        // analysis (CodeQL js/request-forgery) recognizes the URL segment as
        // sanitized, since it doesn't model the custom integer check above.
        .get<ClaimsetSingleWireDtoV3, ClaimsetSingleWireDtoV3>(
          `claimSets/${encodeURIComponent(safeClaimSetId)}`,
        )
        .catch((err) => {
          this.logger.error(
            `Error getting claimset ${safeClaimSetId} for tenant ${edfiTenant.id}: ${err}`,
          );
          throw err;
        }),
    );
  }

  async putClaimset(edfiTenant: EdfiTenant, claimSetId: number, claimSet: PutClaimsetDtoV3) {
    return toGetClaimsetSingleDtoV3(
      await this.getAdminApiClient(edfiTenant)
        .put<ClaimsetSingleWireDtoV3, ClaimsetSingleWireDtoV3>(
          `claimSets/${this.sanitizeClaimSetId(claimSetId)}`,
          claimSet,
        )
        .catch((err) => {
          this.logger.error(
            `Error updating claimset ${this.sanitizeClaimSetId(claimSetId)} for tenant ${edfiTenant.id}: ${err}`,
          );
          throw err;
        }),
    );
  }

  async deleteClaimset(edfiTenant: EdfiTenant, claimSetId: number) {
    await this.getAdminApiClient(edfiTenant)
      .delete(`claimSets/${this.sanitizeClaimSetId(claimSetId)}`)
      .catch((err) => {
        this.logger.error(
          `Error deleting claimset ${this.sanitizeClaimSetId(claimSetId)} for tenant ${edfiTenant.id}: ${err}`,
        );
        throw err;
      });
    return undefined;
  }

  async copyClaimset(edfiTenant: EdfiTenant, copyClaimset: CopyClaimsetDtoV3) {
    const { headers } = await this.getAdminApiClient(edfiTenant, true)
      .post(`claimSets/copy`, copyClaimset)
      .catch((err) => {
        this.logger.error(`Error copying claimset for tenant ${edfiTenant.id}: ${err}`);
        throw err;
      });
    return new Id(Number(headers.location.match(/\d+$/)[0]));
  }

  async importClaimset(edfiTenant: EdfiTenant, importClaimset: ImportClaimsetSingleDtoV3) {
    const { headers } = await this.getAdminApiClient(edfiTenant, true)
      .post(`claimSets/import`, importClaimset)
      .catch((err) => {
        this.logger.error(`Error importing claimset for tenant ${edfiTenant.id}: ${err}`);
        throw err;
      });
    return new Id(Number(headers.location.match(/\d+$/)[0]));
  }

  async exportClaimset(edfiTenant: EdfiTenant, claimSetId: number) {
    return toGetClaimsetSingleDtoV3(
      await this.getAdminApiClient(edfiTenant)
        .get<ClaimsetSingleWireDtoV3, ClaimsetSingleWireDtoV3>(`claimSets/${claimSetId}/export`)
        .catch((err) => {
          this.logger.error(`Error exporting claimset for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        }),
    );
  }

  //
  // Data Stores (renamed from V2's "ODS Instances")
  //

  async getDataStores(edfiTenant: EdfiTenant) {
    return toGetDataStoreSummaryDtoV3(
      await this.getAdminApiClient(edfiTenant)
        .get<GetDataStoreSummaryDtoV3[], GetDataStoreSummaryDtoV3[]>(
          `dataStores?offset=0&limit=10000`,
        )
        .catch((err) => {
          this.logger.error(`Error getting data stores for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        }),
    );
  }

  async postInstance(edfiTenant: EdfiTenant, instance: PostInstanceDtoV3) {
    const { headers } = await this.getAdminApiClient(edfiTenant, true)
      .post('dataStores/manage', instance)
      .catch((err) => {
        this.logger.error(`Error creating instance for tenant ${edfiTenant.id}: ${err}`);
        throw err;
      });
    const location = headers?.location;
    const match = typeof location === 'string' ? location.match(/\d+$/) : null;
    if (!match) {
      this.logger.error(
        `Error creating instance for tenant ${edfiTenant.id}: missing/invalid Location header (${String(location)})`
      );
      throw new Error('Admin API did not return a Location header containing the created instance id.');
    }
    return { id: Number(match[0]) };
  }

  async deleteInstance(edfiTenant: EdfiTenant, instanceManageId: number) {
    await this.getAdminApiClient(edfiTenant, true)
      .delete(`dataStores/manage/${instanceManageId}`)
      .catch((err) => {
        this.logger.error(
          `Error deleting instance ${instanceManageId} for tenant ${edfiTenant.id}: ${err}`
        );
        throw err;
      });
    return undefined;
  }

  //
  // Profiles
  //

  async getProfiles(edfiTenant: EdfiTenant) {
    return toGetProfileDtoV3(
      await this.getAdminApiClient(edfiTenant)
        .get<GetProfileDtoV3[], GetProfileDtoV3[]>(`profiles?offset=0&limit=10000`)
        .catch((err) => {
          this.logger.error(`Error getting profiles for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        }),
    );
  }

  async postProfile(edfiTenant: EdfiTenant, profile: PostProfileDtoV3) {
    const { headers } = await this.getAdminApiClient(edfiTenant, true)
      .post(`profiles`, profile)
      .catch((err) => {
        this.logger.error(`Error creating profile for tenant ${edfiTenant.id}: ${err}`);
        throw err;
      });
    return { id: Number(headers.location.match(/\d+$/)[0]) };
  }

  async getProfile(edfiTenant: EdfiTenant, profileId: number) {
    return toGetProfileDtoV3(
      await this.getAdminApiClient(edfiTenant)
        .get<GetProfileDtoV3, GetProfileDtoV3>(`profiles/${profileId}`)
        .catch((err) => {
          this.logger.error(
            `Error getting profile ${profileId} for tenant ${edfiTenant.id}: ${err}`,
          );
          throw err;
        }),
    );
  }

  async putProfile(edfiTenant: EdfiTenant, profileId: number, profile: PutProfileDtoV3) {
    return toGetProfileDtoV3(
      await this.getAdminApiClient(edfiTenant)
        .put<GetProfileDtoV3, GetProfileDtoV3>(`profiles/${profileId}`, profile)
        .catch((err) => {
          this.logger.error(
            `Error updating profile ${profileId} for tenant ${edfiTenant.id}: ${err}`,
          );
          throw err;
        }),
    );
  }

  async deleteProfile(edfiTenant: EdfiTenant, profileId: number) {
    await this.getAdminApiClient(edfiTenant)
      .delete(`profiles/${profileId}`)
      .catch((err) => {
        this.logger.error(
          `Error deleting profile ${profileId} for tenant ${edfiTenant.id}: ${err}`,
        );
        throw err;
      });
    return undefined;
  }

  //
  // Vendors
  //

  async getVendors(edfiTenant: EdfiTenant) {
    return toGetVendorDtoV3(
      await this.getAdminApiClient(edfiTenant)
        .get<GetVendorDtoV3[], GetVendorDtoV3[]>(`vendors?offset=0&limit=10000`)
        .catch((err) => {
          this.logger.error(`Error getting vendors for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        }),
    );
  }

  async postVendor(edfiTenant: EdfiTenant, vendor: PostVendorDtoV3) {
    const { headers } = await this.getAdminApiClient(edfiTenant, true)
      .post(`vendors`, vendor)
      .catch((err) => {
        this.logger.error(`Error creating vendor for tenant ${edfiTenant.id}: ${err}`);
        throw err;
      });
    return { id: Number(headers.location.match(/\d+$/)[0]) };
  }

  async getVendor(edfiTenant: EdfiTenant, vendorId: number) {
    return toGetVendorDtoV3(
      await this.getAdminApiClient(edfiTenant)
        .get<GetVendorDtoV3, GetVendorDtoV3>(`vendors/${vendorId}`)
        .catch((err) => {
          this.logger.error(`Error getting vendor ${vendorId} for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        }),
    );
  }

  async putVendor(edfiTenant: EdfiTenant, vendorId: number, vendor: PutVendorDtoV3) {
    return toGetVendorDtoV3(
      await this.getAdminApiClient(edfiTenant)
        .put<GetVendorDtoV3, GetVendorDtoV3>(`vendors/${vendorId}`, vendor)
        .catch((err) => {
          this.logger.error(
            `Error updating vendor ${vendorId} for tenant ${edfiTenant.id}: ${err}`,
          );
          throw err;
        }),
    );
  }

  async deleteVendor(edfiTenant: EdfiTenant, vendorId: number) {
    await this.getAdminApiClient(edfiTenant)
      .delete(`vendors/${vendorId}`)
      .catch((err) => {
        this.logger.error(`Error deleting vendor ${vendorId} for tenant ${edfiTenant.id}: ${err}`);
        throw err;
      });
    return undefined;
  }

  /**
   * Run the Admin API job to refresh the EdOrgs for the given environment. This is a long-running operation, so it returns a job ID that can be polled for completion.
   * @param sbEnvironment - The environment whose Admin API client to use
   * @returns Promise<string | null> - The job ID if successfully triggered, otherwise null
   */
  async triggerEdOrgRefresh(sbEnvironment: SbEnvironment): Promise<string | null> {
    return triggerEdOrgRefresh(
      this.getAdminApiClientForEnvironment(sbEnvironment),
      'dataStores/edOrgs/refresh',
      this.logger,
      sbEnvironment.name
    );
  }

  /**
   * Polls GET jobs/{jobId} until the job reaches a terminal state or the attempt limit is reached.
   * Poll parameters are driven by ADMINAPI_REFRESH_POLL_ATTEMPTS and ADMINAPI_REFRESH_POLL_INTERVAL_MS config.
   * @param sbEnvironment - The environment whose Admin API client to use
   * @param jobId - The job ID returned by triggerEdOrgRefresh()
   * @returns 'completed' | 'failed' | 'timeout'
   */
  async pollJobStatus(
    sbEnvironment: SbEnvironment,
    jobId: string
  ): Promise<'completed' | 'failed' | 'timeout'> {
    return pollJobStatus(
      this.getAdminApiClientForEnvironment(sbEnvironment),
      jobId,
      this.logger,
      sbEnvironment.name
    );
  }

  /**
   * Retrieve all tenants with their DataStores and education organizations
   *
   * This method:
   * 1. Calls the root endpoint (GET /) to get tenancy information
   * 2. Determines tenant names based on multitenantMode setting
   * 3. For each tenant, calls /v3/tenants/{tenantName}/dataStores/edOrgs to get detailed information
   * 4. Maps the response to TenantDto format
   *
   * @param environment - SB Environment containing configuration
   * @returns Promise resolving to array of tenant objects with EdOrgs and DataStores
   */
  async getTenants(environment: SbEnvironment): Promise<TenantDto[]> {
    this.logger.log(`Getting tenants for environment: ${environment.name}`);

    try {
      // Step 1: Get tenancy information from root endpoint
      const rootClient = axios.create({
        baseURL: environment.adminApiUrl.replace(/\/$/, ''),
      });

      // Add auth token to root client (environment-level, no tenant)
      let authToken = this.adminApiTokens.get(environment.id);
      if (!authToken) {
        // Login without tenant parameter to get environment-level token
        const adminLogin = await this.login(environment, environment.id);
        if (adminLogin.status !== 'SUCCESS') {
          throw new CustomHttpException(
            {
              title: adminApiLoginStatusMsgs[adminLogin.status],
              type: 'Error',
            },
            500,
          );
        }
        authToken = this.adminApiTokens.get(environment.id);
      }

      const tenancyResponse = await rootClient
        .get<TenancyResponse>('/', {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        })
        .then((res) => res.data)
        .catch((err) => {
          this.logger.error(`Error getting tenancy information: ${err}`);
          throw err;
        });

      // Step 2: Determine tenant names from tenancy response
      let tenantNames: string[];

      if (
        tenancyResponse?.tenancy?.multitenantMode === true &&
        Array.isArray(tenancyResponse.tenancy.tenants) &&
        tenancyResponse.tenancy.tenants.length > 0
      ) {
        // Multi-tenant mode
        tenantNames = tenancyResponse.tenancy.tenants;
        this.logger.log(
          `Multi-tenant mode detected with ${tenantNames.length} tenants: ${tenantNames.join(', ')}`,
        );
      } else {
        // Single-tenant mode
        tenantNames = ['default'];
        this.logger.log('Single-tenant mode detected, using default tenant');
      }

      // Log credential availability for discovered tenants
      const configPublic = environment.configPublic;
      const v2Config =
        'version' in configPublic && configPublic.version === 'v3'
          ? configPublic.values
          : undefined;
      const availableTenants = Object.keys(v2Config?.tenants || {});

      this.logger.log(`Discovered tenants from Admin API: [${tenantNames.join(', ')}]`);
      this.logger.log(
        `Tenants with credentials in environment config: [${availableTenants.join(', ')}]`,
      );

      // Identify tenants without credentials
      const tenantsWithoutCredentials = tenantNames.filter(
        (name) => !availableTenants.includes(name),
      );
      if (tenantsWithoutCredentials.length > 0) {
        this.logger.warn(
          `WARNING: The following tenants were discovered but do NOT have credentials configured: ` +
            `[${tenantsWithoutCredentials.join(', ')}]. ` +
            `These tenants will be created with empty data. ` +
            `Add credentials to your environment configuration to sync their data.`,
        );
      }

      // Step 3: Fetch details for each tenant
      const tenantsWithDetails = await Promise.all(
        tenantNames.map(async (tenantName) => {
          try {
            // Authenticate with tenant-specific credentials
            this.logger.log(`Authenticating for tenant: ${tenantName}`);
            const adminLogin = await this.login(environment, environment.id, tenantName);
            if (adminLogin.status !== 'SUCCESS') {
              const errorMsg = adminApiLoginStatusMsgs[adminLogin.status];
              this.logger.warn(
                `Failed to authenticate tenant "${tenantName}": ${adminLogin.status} - ${errorMsg}. ` +
                  `This tenant will be created with empty data. ` +
                  `Add credentials for "${tenantName}" to your environment configuration to sync its data.`,
              );
              throw new CustomHttpException(
                {
                  title: `Failed to authenticate tenant ${tenantName}`,
                  type: 'Error',
                  message: `${adminLogin.status}: ${errorMsg}. Add credentials for this tenant to sync its data.`,
                },
                500,
              );
            }

            // Create a client with tenant header for multi-tenant API calls
            const client = this.initializeApiClient(environment, true); // Get full response

            // Retrieve tenant-specific token using composite key
            const tokenKey = this.getTenantTokenKey(environment.id, tenantName);
            const token = this.adminApiTokens.get(tokenKey);
            this.logger.log(`Using token key ${tokenKey} for tenant ${tenantName}`);

            // Call the tenant details endpoint with tenant header
            const response = await client
              .get<TenantDataStoresEdOrgsResponse>(`tenants/${tenantName}/dataStores/edOrgs`, {
                headers: {
                  Authorization: `Bearer ${token}`,
                  tenant: tenantName, // Add tenant header for multi-tenant API
                },
              })
              .catch((err) => {
                this.logger.error(`Error getting details for tenant ${tenantName}: ${err.message}`);
                throw err;
              });

            // Extract data from response
            const details = response.data;

            this.logger.log(
              `Retrieved details for tenant ${tenantName} with ${details.dataStores?.length || 0} DataStores`,
            );

            // Step 4: Map the response to TenantDto format
            // Use tenantName (URL identifier) as the stable tenant id and name
            const tenant: TenantDto = {
              id: tenantName,
              name: tenantName,
              odsInstances:
                details.dataStores?.map((instance: AdminApiDataStore) => {
                  const odsInstance: OdsInstanceDto = {
                    id: instance.id ?? null,
                    name: instance.name || 'Unknown ODS Instance',
                    instanceManageId: instance.dataStoreManageId ?? null,
                    instanceType: instance.dataStoreType ?? instance.instanceType ?? null,
                    status: instance.status ?? null,
                    databaseTemplate: instance.databaseTemplate ?? null,
                    databaseName: instance.databaseName ?? null,
                    edOrgs:
                      instance.educationOrganizations?.map((edOrg: AdminApiEducationOrganization) => {
                        const educationOrg: EducationOrganizationDto = {
                          instanceId: instance.id, // Use ODS instance ID
                          instanceName: instance.name, // Use ODS instance name
                          educationOrganizationId: edOrg.educationOrganizationId,
                          nameOfInstitution: edOrg.nameOfInstitution,
                          shortNameOfInstitution: edOrg.shortNameOfInstitution,
                          discriminator: edOrg.discriminator,
                          parentId: edOrg.parentId,
                        };
                        return educationOrg;
                      }) || [],
                  };
                  return odsInstance;
                }) || [],
            };

            return tenant;
          } catch (detailsError) {
            const errorMessage =
              detailsError instanceof Error ? detailsError.message : String(detailsError);
            const errorStack = detailsError instanceof Error ? detailsError.stack : undefined;

            // Extract more specific error information
            let specificReason = errorMessage;
            if ('response' in detailsError && typeof detailsError.response === 'object') {
              const response = detailsError.response as { message?: unknown };
              if (response.message) {
                specificReason =
                  typeof response.message === 'string'
                    ? response.message
                    : JSON.stringify(response.message);
              }
            }

            this.logger.warn(
              `Failed to get details for tenant "${tenantName}": ${specificReason}. ` +
                `Returning tenant with empty ODS instances. ` +
                `This tenant will appear in the database but will have no data until credentials are added.`,
              errorStack,
            );
            // Return tenant with empty details if the details endpoint fails
            return {
              id: tenantName,
              name: tenantName,
              odsInstances: [],
            };
          }
        }),
      );

      return tenantsWithDetails;
    } catch (error) {
      // Only fall back to default tenant if the endpoint doesn't exist (404)
      // This allows older Admin API versions that don't support multi-tenancy to work
      if (isAxiosError(error) && error.response?.status === 404) {
        this.logger.warn(
          `Tenancy endpoint not found for environment ${environment.name} (404). Returning a default tenant for single-tenant API.`,
        );
        // V2 API without multi-tenant support, so we create a default tenant from environment data
        const defaultTenant: TenantDto = {
          id: 'default',
          name: environment.name || 'Default Tenant',
          odsInstances: [],
        };

        return [defaultTenant];
      }

      // For all other errors (auth failures, network issues, server errors), re-throw
      // so administrators can identify and fix configuration problems
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to get tenants for environment ${environment.name}: ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }

  /**
   * Get all education organizations across all ODS instances for a tenant
   * Calls GET odsInstances/edOrgs endpoint which returns Ed-Orgs grouped by ODS instance
   *
   * @param edfiTenant - The tenant to get Ed-Orgs for
   * @returns Promise resolving to array of EducationOrganizationDto objects with instanceId populated
   */
  async getAllEdOrgsForTenant(edfiTenant: EdfiTenant): Promise<EducationOrganizationDto[]> {
    this.logger.log(`Getting all Ed-Orgs for tenant ${edfiTenant.name} (id=${edfiTenant.id})`);

    try {
      type AdminApiEdOrg = {
        educationOrganizationId: number;
        nameOfInstitution: string;
        shortNameOfInstitution?: string | null;
        discriminator: string;
        parentId?: number | null;
      };

      type OdsInstanceEdOrgsResponse = {
        id: number;
        name: string;
        instanceType: string | null;
        educationOrganizations?: AdminApiEdOrg[];
      };

      const response = await this.getAdminApiClient(edfiTenant)
        .get<OdsInstanceEdOrgsResponse[], OdsInstanceEdOrgsResponse[]>('dataStores/edOrgs')
        .catch((err) => {
          this.logger.error(
            `Error getting Ed-Orgs for tenant ${edfiTenant.id}: ${err.message || err}`,
            err.stack,
          );
          throw err;
        });

      // Flatten Ed-Orgs from all ODS instances, enriching each with instanceId and instanceName
      const allEdOrgs: EducationOrganizationDto[] = response.flatMap((instance) =>
        (instance.educationOrganizations ?? []).map((edOrg) => ({
          instanceId: instance.id,
          instanceName: instance.name,
          educationOrganizationId: edOrg.educationOrganizationId,
          nameOfInstitution: edOrg.nameOfInstitution,
          shortNameOfInstitution: edOrg.shortNameOfInstitution ?? null,
          discriminator: edOrg.discriminator,
          parentId: edOrg.parentId ?? null,
        })),
      );

      this.logger.log(
        `Successfully retrieved ${allEdOrgs.length} Ed-Orgs from ${response.length} ODS instance(s) for tenant ${edfiTenant.name}`,
      );

      return allEdOrgs;
    } catch (error) {
      this.logger.error(
        `Failed to get all Ed-Orgs for tenant ${edfiTenant.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Sanitize claimSetId by ensuring it is a positive integer
   *
   * @param claimSetId - The claimSetId to sanitize
   * @returns The sanitized claimSetId
   * @throws CustomHttpException if claimSetId is not a positive integer
   */
  private sanitizeClaimSetId(claimSetId: number): number {
    if (!Number.isInteger(claimSetId) || claimSetId <= 0) {
      throw new CustomHttpException(
        {
          title: `Invalid claimSetId: ${claimSetId}`,
          type: 'Error',
          message: `claimSetId: ${claimSetId} must be a positive integer.`,
        },
        400,
      );
    }
    return claimSetId;
  }
}
