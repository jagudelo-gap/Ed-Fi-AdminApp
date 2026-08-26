import {
  CopyClaimsetDtoV2,
  EducationOrganizationDto,
  GetActionDtoV2,
  GetApiClientDtoV2,
  GetApplicationDtoV2,
  GetAuthStrategyDtoV2,
  GetClaimsetMultipleDtoV2,
  GetClaimsetSingleDtoV2,
  GetOdsInstanceContextDtoV2,
  GetOdsInstanceDerivativeDtoV2,
  GetOdsInstanceDetailDtoV2,
  GetOdsInstanceSummaryDtoV2,
  GetProfileDtoV2,
  GetResourceClaimDetailDtoV2,
  GetVendorDtoV2,
  ISbEnvironmentConfigPrivateV2,
  Id,
  ImportClaimsetSingleDtoV2,
  OdsInstanceDto,
  PostApiClientDtoV2,
  PostActionAuthStrategiesDtoV2,
  PostApplicationDtoV2,
  PostClaimsetDtoV2,
  PostClaimsetResourceClaimActionsDtoV2,
  PostInstanceDtoV2,
  PostOdsInstanceContextDtoV2,
  PostOdsInstanceDerivativeDtoV2,
  PostApplicationResponseDtoV2,
  PostOdsInstanceDtoV2,
  PostProfileDtoV2,
  PostVendorDtoV2,
  PutApiClientDtoV2,
  PutApplicationDtoV2,
  PutClaimsetDtoV2,
  PutClaimsetResourceClaimActionsDtoV2,
  PutOdsInstanceContextDtoV2,
  PutOdsInstanceDerivativeDtoV2,
  PutOdsInstanceDtoV2,
  PutProfileDtoV2,
  PutVendorDtoV2,
  TenantDto,
  toGetActionDtoV2,
  toGetApplicationDtoV2,
  toGetApiClientDtoV2,
  toGetAuthStrategyDtoV2,
  toGetClaimsetMultipleDtoV2,
  toGetClaimsetSingleDtoV2,
  toGetOdsInstanceContextDtoV2,
  toGetOdsInstanceDerivativeDtoV2,
  toGetOdsInstanceDetailDtoV2,
  toGetOdsInstanceSummaryDtoV2,
  toGetProfileDtoV2,
  toGetResourceClaimDetailDtoV2,
  toGetVendorDtoV2,
  toPostApplicationResponseDtoV2,
  PostApiClientResponseDtoV2,
  toPostApiClientResponseDtoV2,
} from '@edanalytics/models';
import { EdfiTenant, SbEnvironment } from '@edanalytics/models-server';
import { Inject, Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError, isAxiosError } from 'axios';
import crypto from 'crypto';
import NodeCache from 'node-cache';
import { CustomHttpException } from '../../../../utils';
import {
  pollJobStatus,
  triggerEdOrgRefresh,
} from '../admin-api-refresh-poll.util';
import { StartingBlocksServiceV2 } from './starting-blocks.v2.service';
import { adminApiLoginStatusMsgs } from '../../adminApiLoginFailureMsgs';

/**
 * Error body shape returned by the Admin API on failed requests (e.g. registration/login).
 */
interface AdminApiErrorResponseBody {
  message?: string;
  errors?: Record<string, string[]> | string[];
}

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
 * `odsInstances/edOrgs`-family endpoints (raw shape, not yet mapped to EducationOrganizationDto).
 */
interface AdminApiEducationOrganization {
  educationOrganizationId: number;
  nameOfInstitution: string;
  shortNameOfInstitution?: string | null;
  discriminator: string;
  parentId?: number | null;
}

/**
 * A single ODS instance as returned by the Admin API's `odsInstances/edOrgs`-family
 * endpoints (raw shape, not yet mapped to OdsInstanceDto).
 */
interface AdminApiOdsInstance {
  id: number | null;
  name: string;
  odsInstanceManageId?: number | null;
  instanceType: string | null;
  status?: string | null;
  databaseTemplate?: string | null;
  databaseName?: string | null;
  educationOrganizations?: AdminApiEducationOrganization[];
}

/**
 * Response shape of `tenants/{tenantName}/odsInstances/edOrgs`.
 */
interface TenantOdsInstancesEdOrgsResponse {
  odsInstances?: AdminApiOdsInstance[];
}

/**
 * This service is used to interact with the Admin API. Each method is a single
 * API call (plus login if token is expired).
 *
 * Each call uses the `getAdminApiClient` method, which throws explicit HTTP 500s
 * and doesn't leak any internal exceptions. So any Axios errors (e.g. 404) or
 * other non-Nest exceptions encountered externally can be assumed to have arisen
 * in the actual call of interest.
 */
@Injectable()
export class AdminApiServiceV2 {
  private adminApiTokens: NodeCache;
  private readonly logger = new Logger(AdminApiServiceV2.name);

  constructor(
    @Inject(StartingBlocksServiceV2) private startingBlocksService: StartingBlocksServiceV2
  ) {
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
    const v2Config =
      'version' in configPublic && configPublic.version === 'v2' ? configPublic.values : undefined;
    const v2ConfigPrivate =
      'version' in configPublic && configPublic.version === 'v2'
        ? (configPrivate as ISbEnvironmentConfigPrivateV2)
        : undefined;

    if (!v2Config || !v2ConfigPrivate) {
      return {
        status: 'NO_CONFIG' as const,
      };
    }

    // If no tenant name provided, try to find the first available tenant credentials
    // This is needed for initial tenant discovery in EdFi environments
    if (!tenantName) {
      const availableTenants = v2Config.tenants ? Object.keys(v2Config.tenants) : [];
      
      if (availableTenants.length === 0) {
        return {
          status: 'NO_TENANT_CONFIG' as const,
        };
      }
      
      // Prefer 'default' tenant if available, otherwise use first tenant
      tenantName = availableTenants.includes('default') 
        ? 'default' 
        : availableTenants[0];
      
      this.logger.log(`No tenant specified for login, using tenant: ${tenantName}`);
    }

    if (!v2Config?.tenants[tenantName] || !v2ConfigPrivate?.tenants[tenantName]) {
      return {
        status: 'NO_TENANT_CONFIG' as const,
      };
    }
    const adminApiUrl = sbEnvironment.adminApiUrl;
    const adminApiKey = v2Config?.tenants[tenantName]?.adminApiKey;
    const adminApiSecret = v2ConfigPrivate?.tenants[tenantName]?.adminApiSecret;

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

    const options = tenantName ? {
      method: 'POST',
      url: accessTokenUri,
      headers: {
        Accept: 'application/json',
        tenant: tenantName,
      },
      data: reqBody,
    } : {
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
        // Store token: environment-level (no tenant) uses just ID, tenant-specific uses composite key
        const tokenKey = tenantName ? this.getTenantTokenKey(id, tenantName) : id;
        this.adminApiTokens.set(tokenKey, v.data.access_token, Number(v.data.expires_in) - 60);
        this.logger.log(`Stored token for environment ${id}${tenantName ? ` tenant ${tenantName}` : ' (environment-level)'} at key: ${tokenKey}`);
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

  async selfRegisterAdminApi(edfiTenant: EdfiTenant) {
    const configPublic = edfiTenant.sbEnvironment.configPublic;
    const v2Config =
      'version' in configPublic && configPublic.version === 'v2' ? configPublic.values : undefined;

    if (!v2Config) {
      return {
        status: 'NO_CONFIG' as const,
      };
    }
    const adminApiUrl = edfiTenant.sbEnvironment.adminApiUrl;

    if (typeof adminApiUrl !== 'string') {
      return {
        status: 'NO_ADMIN_API_URL' as const,
      };
    }
    let registrationUri = '';
    try {
      const url = new URL(adminApiUrl);
      url.pathname = url.pathname.replace(/\/$/, '') + '/connect/token';
      registrationUri = url.toString();
    } catch (InvalidUrl) {
      this.logger.log(InvalidUrl);
      return {
        status: 'INVALID_ADMIN_API_URL' as const,
      };
    }
    const ClientId = crypto.randomBytes(16).toString('hex');
    const ClientSecret = crypto.randomBytes(128).toString('base64');
    const DisplayName = `Ed-Fi Admin App ${Number(new Date())}ms`;
    const credentials = {
      ClientId,
      ClientSecret,
      DisplayName,
    };

    return (
      axios
        .post(registrationUri, credentials, {
          headers: { 'content-type': 'application/x-www-form-urlencoded', tenant: edfiTenant.name },
        })
        .then(async () => {
          await this.startingBlocksService.saveAdminApiCredentials(
            edfiTenant,
            edfiTenant.sbEnvironment,
            credentials
          );
          return { status: 'SUCCESS' as const };
        })
        .catch((err: AxiosError<AdminApiErrorResponseBody>) => {
          if (err.response?.data?.errors) {
            this.logger.warn(JSON.stringify(err.response.data.errors));
            return {
              status: 'ERROR' as const,
              data: err.response.data as object,
            };
          } else if (err?.code === 'ENOTFOUND') {
            this.logger.warn('Attempted to register Admin API but ENOTFOUND: ' + registrationUri);
            return {
              status: 'ENOTFOUND' as const,
            };
          } else {
            this.logger.warn(err);
            return {
              status: 'ERROR' as const,
            };
          }
        })
    );
  }

  /**
   * Get an authenticated API client for a specific tenant.
   * Used by sync services to make tenant-specific Admin API calls.
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
        const adminLogin = await this.login(edfiTenant.sbEnvironment, edfiTenant.sbEnvironment.id, edfiTenant.name);

        if (adminLogin.status !== 'SUCCESS') {
          const errorMsg = adminApiLoginStatusMsgs[adminLogin.status];
          this.logger.error(
            `Authentication failed for tenant ${edfiTenant.name}: ${adminLogin.status} - ${errorMsg}`
          );
          throw new CustomHttpException(
            {
              title: `Authentication failed for tenant ${edfiTenant.name}`,
              type: 'Error',
              message: `${adminLogin.status}: ${errorMsg}`,
            },
            500
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
    const v2Config =
      'version' in configPublic && configPublic.version === 'v2' ? configPublic.values : undefined;
    const availableTenants = v2Config?.tenants ? Object.keys(v2Config.tenants) : [];
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

  private initializeApiClient(environment: SbEnvironment, notJustData?: boolean) {
    const client = axios.create({
      baseURL: environment.adminApiUrl.replace(/\/$/, '') + '/v2/',
    });
    client.interceptors.response.use(
      notJustData
        ? (value) => value
        : (value) => {
          return value.data;
        }
    );
    return client;
  }

  async getActions(edfiTenant: EdfiTenant) {
    return toGetActionDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .get<GetActionDtoV2[], GetActionDtoV2[]>(`actions?offset=0&limit=10000`)
        .catch((err) => {
          this.logger.error(`Error getting actions for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }

  async getApplications(edfiTenant: EdfiTenant) {
    return toGetApplicationDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .get<GetApplicationDtoV2[], GetApplicationDtoV2[]>(`applications?offset=0&limit=10000`)
        .catch((err) => {
          this.logger.error(`Error getting applications for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }

  async postApplication(edfiTenant: EdfiTenant, application: PostApplicationDtoV2) {
    return toPostApplicationResponseDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .post<PostApplicationResponseDtoV2, PostApplicationResponseDtoV2>(
          `applications`,
          application
        )
        .catch((err) => {
          this.logger.error(`Error creating application for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }

  async getApplication(edfiTenant: EdfiTenant, applicationId: number) {
    return toGetApplicationDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .get<GetApplicationDtoV2, GetApplicationDtoV2>(`applications/${applicationId}`)
        .catch((err) => {
          this.logger.error(
            `Error getting application ${applicationId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }

  async putApplication(
    edfiTenant: EdfiTenant,
    applicationId: number,
    application: PutApplicationDtoV2
  ) {
    return toGetApplicationDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .put<GetApplicationDtoV2, GetApplicationDtoV2>(
          `applications/${applicationId}`,
          application
        )
        .catch((err) => {
          this.logger.error(
            `Error updating application ${applicationId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }

  async deleteApplication(edfiTenant: EdfiTenant, applicationId: number) {
    await this.getAdminApiClient(edfiTenant)
      .delete(`applications/${applicationId}`)
      .catch((err) => {
        this.logger.error(
          `Error deleting application ${applicationId} for tenant ${edfiTenant.id}: ${err}`
        );
        throw err;
      });
    return undefined;
  }

  async putApplicationResetCredential(edfiTenant: EdfiTenant, applicationId: number) {
    return toPostApplicationResponseDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .put<PostApplicationResponseDtoV2, PostApplicationResponseDtoV2>(
          `applications/${applicationId}/reset-credential`
        )
        .catch((err) => {
          this.logger.error(
            `Error resetting application credential for application ${applicationId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }

  async getApiClients(edfiTenant: EdfiTenant, applicationId: number) {
    return toGetApiClientDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .get<GetApiClientDtoV2[], GetApiClientDtoV2[]>(
          `apiClients?offset=0&limit=10000&applicationId=${applicationId}`
        )
        .catch((err) => {
          this.logger.error(`Error getting API clients for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }

  async getApiClient(edfiTenant: EdfiTenant, apiClientId: number) {
    return toGetApiClientDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .get<GetApiClientDtoV2, GetApiClientDtoV2>(`apiClients/${apiClientId}`)
        .catch((err) => {
          this.logger.error(
            `Error getting API client ${apiClientId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }

  async putApiClient(edfiTenant: EdfiTenant, apiClientId: number, apiClient: PutApiClientDtoV2) {
    return toGetApiClientDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .put<GetApiClientDtoV2, GetApiClientDtoV2>(`apiClients/${apiClientId}`, apiClient)
        .catch((err) => {
          this.logger.error(
            `Error updating API client ${apiClientId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }

  async postApiClient(
     edfiTenant: EdfiTenant,
     apiClient: PostApiClientDtoV2
   ): Promise<PostApiClientResponseDtoV2> {
     return toPostApiClientResponseDtoV2(
       await this.getAdminApiClient(edfiTenant)
         .post<PostApiClientResponseDtoV2, PostApiClientResponseDtoV2>(`apiClients`, apiClient)
         .catch((err) => {
           this.logger.error(`Error creating API client for tenant ${edfiTenant.id}: ${err}`);
           throw err;
         })
     );
  }

  async putApiClientResetCredential(edfiTenant: EdfiTenant, apiClientId: number) {
    return toPostApiClientResponseDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .put<PostApiClientResponseDtoV2, PostApiClientResponseDtoV2>(
          `apiClients/${apiClientId}/reset-credential`
        )
        .catch((err) => {
          this.logger.error(
            `Error resetting API client credential for API client ${apiClientId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }

  async deleteApiClient(edfiTenant: EdfiTenant, apiClientId: number) {
    await this.getAdminApiClient(edfiTenant)
      .delete(`apiClients/${apiClientId}`)
      .catch((err) => {
        this.logger.error(
          `Error deleting API client ${apiClientId} for tenant ${edfiTenant.id}: ${err}`
        );
        throw err;
      });
    return undefined;
  }

  async getAuthorizationStrategies(edfiTenant: EdfiTenant) {
    return toGetAuthStrategyDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .get<GetAuthStrategyDtoV2[], GetAuthStrategyDtoV2[]>(
          `authorizationStrategies?offset=0&limit=10000`
        )
        .catch((err) => {
          this.logger.error(
            `Error getting authorization strategies for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }

  async getClaimsets(edfiTenant: EdfiTenant) {
    return toGetClaimsetMultipleDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .get<GetClaimsetMultipleDtoV2[], GetClaimsetMultipleDtoV2[]>(
          `claimSets?offset=0&limit=10000`
        )
        .catch((err) => {
          this.logger.error(`Error getting claimsets for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }

  async postClaimset(edfiTenant: EdfiTenant, claimSet: PostClaimsetDtoV2) {
    return toGetClaimsetSingleDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .post<GetClaimsetSingleDtoV2, GetClaimsetSingleDtoV2>(`claimSets`, claimSet)
        .catch((err) => {
          this.logger.error(`Error creating claimset for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }

  async getClaimset(edfiTenant: EdfiTenant, claimSetId: number) {
    const validatedClaimSetId = Number(claimSetId);
    if (!Number.isSafeInteger(validatedClaimSetId) || validatedClaimSetId <= 0) {
      throw new CustomHttpException({ title: 'Invalid claimsetId', type: 'Error' }, 400);
    }

    return toGetClaimsetSingleDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .get<GetClaimsetSingleDtoV2, GetClaimsetSingleDtoV2>(
          `claimSets/${validatedClaimSetId}`
        )
        .catch((err) => {
          this.logger.error(
            `Error getting claimset ${validatedClaimSetId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }

  async putClaimset(edfiTenant: EdfiTenant, claimSetId: number, claimSet: PutClaimsetDtoV2) {
    return toGetClaimsetSingleDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .put<GetClaimsetSingleDtoV2, GetClaimsetSingleDtoV2>(
          `claimSets/${claimSetId}`,
          claimSet
        )
        .catch((err) => {
          this.logger.error(
            `Error updating claimset ${claimSetId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }

  async deleteClaimset(edfiTenant: EdfiTenant, claimSetId: number) {
    await this.getAdminApiClient(edfiTenant)
      .delete(`claimSets/${claimSetId}`)
      .catch((err) => {
        this.logger.error(
          `Error deleting claimset ${claimSetId} for tenant ${edfiTenant.id}: ${err}`
        );
        throw err;
      });
    return undefined;
  }

  async postClaimsetResourceClaimAction(
    edfiTenant: EdfiTenant,
    claimSetId: number,
    resourceClaimAction: PostClaimsetResourceClaimActionsDtoV2
  ) {
    return toGetClaimsetSingleDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .post<GetClaimsetSingleDtoV2, GetClaimsetSingleDtoV2>(
          `claimSets/${claimSetId}/resourceClaimActions`,
          resourceClaimAction
        )
        .catch((err) => {
          this.logger.error(
            `Error creating claimset ${claimSetId} resource claim action for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }

  async putClaimsetResourceClaimAction(
    edfiTenant: EdfiTenant,
    claimSetId: number,
    resourceClaimId: number,
    resourceClaimAction: PutClaimsetResourceClaimActionsDtoV2
  ) {
    return toGetClaimsetSingleDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .put<GetClaimsetSingleDtoV2, GetClaimsetSingleDtoV2>(
          `claimSets/${claimSetId}/resourceClaimActions/${resourceClaimId}`,
          resourceClaimAction
        )
        .catch((err) => {
          this.logger.error(
            `Error updating claimset ${claimSetId} resource claim action for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }

  async postOverrideAuthorizationStrategy(
    edfiTenant: EdfiTenant,
    claimSetId: number,
    resourceClaimId: number,
    overrideAuthorizationStrategy: PostActionAuthStrategiesDtoV2
  ) {
    return toGetClaimsetSingleDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .post<GetClaimsetSingleDtoV2, GetClaimsetSingleDtoV2>(
          `claimSets/${claimSetId}/resourceClaimActions/${resourceClaimId}/overrideAuthorizationStrategy`,
          overrideAuthorizationStrategy
        )
        .catch((err) => {
          this.logger.error(
            `Error updating claimset ${claimSetId} resource claim ${resourceClaimId} action for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }

  async resetAuthorizationStrategies(
    edfiTenant: EdfiTenant,
    claimSetId: number,
    resourceClaimId: number
  ) {
    return toGetClaimsetSingleDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .post<GetClaimsetSingleDtoV2, GetClaimsetSingleDtoV2>(
          `claimSets/${claimSetId}/resourceClaimActions/${resourceClaimId}/resetAuthorizationStrategies`
        )
        .catch((err) => {
          this.logger.error(
            `Error resetting authorization strategies for resourceClaimId ${resourceClaimId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }

  async deleteClaimsetResourceClaimAction(
    edfiTenant: EdfiTenant,
    claimSetId: number,
    resourceClaimId: number
  ) {
    return toGetClaimsetSingleDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .delete<GetClaimsetSingleDtoV2, GetClaimsetSingleDtoV2>(
          `claimSets/${claimSetId}/resourceClaimActions/${resourceClaimId}`
        )
        .catch((err) => {
          this.logger.error(
            `Error deleting claimset ${claimSetId} resource claim action ${resourceClaimId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }

  async copyClaimset(edfiTenant: EdfiTenant, copyClaimset: CopyClaimsetDtoV2) {
    const { headers } = await this.getAdminApiClient(edfiTenant, true)
      .post(`claimSets/copy`, copyClaimset)
      .catch((err) => {
        this.logger.error(`Error copying claimset for tenant ${edfiTenant.id}: ${err}`);
        throw err;
      });
    return new Id(Number(headers.location.match(/\d+$/)[0]));
  }

  async importClaimset(edfiTenant: EdfiTenant, importClaimset: ImportClaimsetSingleDtoV2) {
    const { headers } = await this.getAdminApiClient(edfiTenant, true)
      .post(`claimSets/import`, importClaimset)
      .catch((err) => {
        this.logger.error(`Error importing claimset for tenant ${edfiTenant.id}: ${err}`);
        throw err;
      });
    return new Id(Number(headers.location.match(/\d+$/)[0]));
  }

  async exportClaimset(edfiTenant: EdfiTenant, claimSetId: number) {
    return toGetClaimsetSingleDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .get<GetClaimsetSingleDtoV2, GetClaimsetSingleDtoV2>(`claimSets/${claimSetId}/export`)
        .catch((err) => {
          this.logger.error(`Error exporting claimset for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }

  async getEdOrgsForOdsInstance(
    edfiTenant: EdfiTenant,
    odsInstanceId: number
  ): Promise<EducationOrganizationDto[]> {
    type OdsInstanceEdOrgsResponse = {
      id: number;
      name: string;
      instanceType: string | null;
      educationOrganizations?: EducationOrganizationDto[];
    };
    const response = await this.getAdminApiClient(edfiTenant)
      .get<OdsInstanceEdOrgsResponse[], OdsInstanceEdOrgsResponse[]>(
        `odsInstances/${odsInstanceId}/edOrgs`
      )
      .catch((err) => {
        this.logger.error(
          `Error getting Ed-Orgs for ODS instance ${odsInstanceId} for tenant ${edfiTenant.id}: ${err}`
        );
        throw err;
      });
    return response.flatMap((instance) => instance.educationOrganizations ?? []);
  }

  async getOdsInstances(edfiTenant: EdfiTenant) {
    return toGetOdsInstanceSummaryDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .get<GetOdsInstanceSummaryDtoV2[], GetOdsInstanceSummaryDtoV2[]>(
          `odsInstances?offset=0&limit=10000`
        )
        .catch((err) => {
          this.logger.error(`Error getting ODS instances for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }

  async postOdsInstance(edfiTenant: EdfiTenant, odsInstance: PostOdsInstanceDtoV2) {
    return toGetOdsInstanceDetailDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .post<GetOdsInstanceDetailDtoV2, GetOdsInstanceDetailDtoV2>(`odsInstances`, odsInstance)
        .catch((err) => {
          this.logger.error(`Error creating ODS instance for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }

  async postInstance(edfiTenant: EdfiTenant, instance: PostInstanceDtoV2) {
    const { headers } = await this.getAdminApiClient(edfiTenant, true)
      .post('odsInstances/manage', instance)
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
      .delete(`odsInstances/manage/${instanceManageId}`)
      .catch((err) => {
        this.logger.error(
          `Error deleting instance ${instanceManageId} for tenant ${edfiTenant.id}: ${err}`
        );
        throw err;
      });
    return undefined;
  }

  async getOdsInstance(edfiTenant: EdfiTenant, odsInstanceId: number) {
    return toGetOdsInstanceDetailDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .get<GetOdsInstanceDetailDtoV2, GetOdsInstanceDetailDtoV2>(
          `odsInstances/${odsInstanceId}`
        )
        .catch((err) => {
          this.logger.error(
            `Error getting ODS instance ${odsInstanceId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }

  async putOdsInstance(
    edfiTenant: EdfiTenant,
    odsInstanceId: number,
    odsInstance: PutOdsInstanceDtoV2
  ) {
    return toGetOdsInstanceDetailDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .put<GetOdsInstanceDetailDtoV2, GetOdsInstanceDetailDtoV2>(
          `odsInstances/${odsInstanceId}`,
          odsInstance
        )
        .catch((err) => {
          this.logger.error(
            `Error updating ODS instance ${odsInstanceId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }

  async deleteOdsInstance(edfiTenant: EdfiTenant, odsInstanceId: number) {
    await this.getAdminApiClient(edfiTenant)
      .delete(`odsInstances/${odsInstanceId}`)
      .catch((err) => {
        this.logger.error(
          `Error deleting ODS instance ${odsInstanceId} for tenant ${edfiTenant.id}: ${err}`
        );
        throw err;
      });
    return undefined;
  }

  async getOdsInstanceApplications(edfiTenant: EdfiTenant, odsInstanceId: number) {
    // Note: this endpoint's raw shape actually matches GetApplicationAssignedToOdsInstanceDtoV2
    // (a singular `odsInstanceId` rather than `odsInstanceIds`), but the response is passed
    // through the same toGetApplicationDtoV2 wrapper used by the other application-list
    // methods in this file, so it is typed to match that wrapper's expected input here.
    return toGetApplicationDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .get<GetApplicationDtoV2[], GetApplicationDtoV2[]>(
          `odsInstances/${odsInstanceId}/applications?offset=0&limit=10000`
        )
        .catch((err) => {
          this.logger.error(
            `Error getting applications for ODS Instance ${odsInstanceId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }

  async getOdsInstanceContexts(edfiTenant: EdfiTenant) {
    return toGetOdsInstanceContextDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .get<GetOdsInstanceContextDtoV2[], GetOdsInstanceContextDtoV2[]>(
          `odsInstanceContexts?offset=0&limit=10000`
        )
        .catch((err) => {
          this.logger.error(
            `Error getting ODS instance contexts for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }

  async postOdsInstanceContext(
    edfiTenant: EdfiTenant,
    odsInstanceContext: PostOdsInstanceContextDtoV2
  ) {
    return toGetOdsInstanceContextDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .post<GetOdsInstanceContextDtoV2, GetOdsInstanceContextDtoV2>(
          `odsInstanceContexts`,
          odsInstanceContext
        )
        .catch((err) => {
          this.logger.error(
            `Error creating ODS instance context for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }

  async getOdsInstanceContext(edfiTenant: EdfiTenant, odsInstanceContextId: number) {
    return toGetOdsInstanceContextDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .get<GetOdsInstanceContextDtoV2, GetOdsInstanceContextDtoV2>(
          `odsInstanceContexts/${odsInstanceContextId}`
        )
        .catch((err) => {
          this.logger.error(
            `Error getting ODS instance context ${odsInstanceContextId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }

  async putOdsInstanceContext(
    edfiTenant: EdfiTenant,
    odsInstanceContextId: number,
    odsInstanceContext: PutOdsInstanceContextDtoV2
  ) {
    return toGetOdsInstanceContextDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .put<GetOdsInstanceContextDtoV2, GetOdsInstanceContextDtoV2>(
          `odsInstanceContexts/${odsInstanceContextId}`,
          odsInstanceContext
        )
        .catch((err) => {
          this.logger.error(
            `Error updating ODS instance context ${odsInstanceContextId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }

  async deleteOdsInstanceContext(edfiTenant: EdfiTenant, odsInstanceContextId: number) {
    await this.getAdminApiClient(edfiTenant)
      .delete(`odsInstanceContexts/${odsInstanceContextId}`)
      .catch((err) => {
        this.logger.error(
          `Error deleting ODS instance context ${odsInstanceContextId} for tenant ${edfiTenant.id}: ${err}`
        );
        throw err;
      });
    return undefined;
  }

  async getOdsInstanceDerivatives(edfiTenant: EdfiTenant) {
    return toGetOdsInstanceDerivativeDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .get<GetOdsInstanceDerivativeDtoV2[], GetOdsInstanceDerivativeDtoV2[]>(
          `odsInstanceDerivatives?offset=0&limit=10000`
        )
        .catch((err) => {
          this.logger.error(
            `Error getting ODS instance derivatives for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }

  async postOdsInstanceDerivative(
    edfiTenant: EdfiTenant,
    odsInstanceDerivative: PostOdsInstanceDerivativeDtoV2
  ) {
    return toGetOdsInstanceDerivativeDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .post<GetOdsInstanceDerivativeDtoV2, GetOdsInstanceDerivativeDtoV2>(
          `odsInstanceDerivatives`,
          odsInstanceDerivative
        )
        .catch((err) => {
          this.logger.error(
            `Error creating ODS instance derivative for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }

  async getOdsInstanceDerivative(edfiTenant: EdfiTenant, odsInstanceDerivativeId: number) {
    return toGetOdsInstanceDerivativeDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .get<GetOdsInstanceDerivativeDtoV2, GetOdsInstanceDerivativeDtoV2>(
          `odsInstanceDerivatives/${odsInstanceDerivativeId}`
        )
        .catch((err) => {
          this.logger.error(
            `Error getting ODS instance derivative ${odsInstanceDerivativeId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }

  async putOdsInstanceDerivative(
    edfiTenant: EdfiTenant,
    odsInstanceDerivativeId: number,
    odsInstanceDerivative: PutOdsInstanceDerivativeDtoV2
  ) {
    return toGetOdsInstanceDerivativeDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .put<GetOdsInstanceDerivativeDtoV2, GetOdsInstanceDerivativeDtoV2>(
          `odsInstanceDerivatives/${odsInstanceDerivativeId}`,
          odsInstanceDerivative
        )
        .catch((err) => {
          this.logger.error(
            `Error updating ODS instance derivative ${odsInstanceDerivativeId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }

  async deleteOdsInstanceDerivative(edfiTenant: EdfiTenant, odsInstanceDerivativeId: number) {
    await this.getAdminApiClient(edfiTenant)
      .delete(`odsInstanceDerivatives/${odsInstanceDerivativeId}`)
      .catch((err) => {
        this.logger.error(
          `Error deleting ODS instance derivative ${odsInstanceDerivativeId} for tenant ${edfiTenant.id}: ${err}`
        );
        throw err;
      });
    return undefined;
  }

  async getProfiles(edfiTenant: EdfiTenant) {
    return toGetProfileDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .get<GetProfileDtoV2[], GetProfileDtoV2[]>(`profiles?offset=0&limit=10000`)
        .catch((err) => {
          this.logger.error(`Error getting profiles for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }

  async postProfile(edfiTenant: EdfiTenant, profile: PostProfileDtoV2) {
    const { headers } = await this.getAdminApiClient(edfiTenant, true)
      .post(`profiles`, profile)
      .catch((err) => {
        this.logger.error(`Error creating profile for tenant ${edfiTenant.id}: ${err}`);
        throw err;
      });
    return { id: Number(headers.location.match(/\d+$/)[0]) };
  }

  async getProfile(edfiTenant: EdfiTenant, profileId: number) {
    return toGetProfileDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .get<GetProfileDtoV2, GetProfileDtoV2>(`profiles/${profileId}`)
        .catch((err) => {
          this.logger.error(
            `Error getting profile ${profileId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }

  async putProfile(edfiTenant: EdfiTenant, profileId: number, profile: PutProfileDtoV2) {
    return toGetProfileDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .put<GetProfileDtoV2, GetProfileDtoV2>(`profiles/${profileId}`, profile)
        .catch((err) => {
          this.logger.error(
            `Error updating profile ${profileId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }

  async deleteProfile(edfiTenant: EdfiTenant, profileId: number) {
    await this.getAdminApiClient(edfiTenant)
      .delete(`profiles/${profileId}`)
      .catch((err) => {
        this.logger.error(
          `Error deleting profile ${profileId} for tenant ${edfiTenant.id}: ${err}`
        );
        throw err;
      });
    return undefined;
  }

  async getResourceClaims(edfiTenant: EdfiTenant) {
    return toGetResourceClaimDetailDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .get<GetResourceClaimDetailDtoV2[], GetResourceClaimDetailDtoV2[]>(
          `resourceClaims?offset=0&limit=10000`
        )
        .catch((err) => {
          this.logger.error(`Error getting resource claims for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }

  async getResourceClaim(edfiTenant: EdfiTenant, resourceClaimId: number) {
    return toGetResourceClaimDetailDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .get<GetResourceClaimDetailDtoV2, GetResourceClaimDetailDtoV2>(
          `resourceClaims/${resourceClaimId}`
        )
        .catch((err) => {
          this.logger.error(
            `Error getting resource claim ${resourceClaimId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }

  async getVendors(edfiTenant: EdfiTenant) {
    return toGetVendorDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .get<GetVendorDtoV2[], GetVendorDtoV2[]>(`vendors?offset=0&limit=10000`)
        .catch((err) => {
          this.logger.error(`Error getting vendors for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }

  async postVendor(edfiTenant: EdfiTenant, vendor: PostVendorDtoV2) {
    const { headers } = await this.getAdminApiClient(edfiTenant, true)
      .post(`vendors`, vendor)
      .catch((err) => {
        this.logger.error(`Error creating vendor for tenant ${edfiTenant.id}: ${err}`);
        throw err;
      });
    return { id: Number(headers.location.match(/\d+$/)[0]) };
  }

  async getVendor(edfiTenant: EdfiTenant, vendorId: number) {
    return toGetVendorDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .get<GetVendorDtoV2, GetVendorDtoV2>(`vendors/${vendorId}`)
        .catch((err) => {
          this.logger.error(`Error getting vendor ${vendorId} for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }

  async putVendor(edfiTenant: EdfiTenant, vendorId: number, vendor: PutVendorDtoV2) {
    return toGetVendorDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .put<GetVendorDtoV2, GetVendorDtoV2>(`vendors/${vendorId}`, vendor)
        .catch((err) => {
          this.logger.error(
            `Error updating vendor ${vendorId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
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

  async getVendorApplications(edfiTenant: EdfiTenant, vendorId: number) {
    return toGetApplicationDtoV2(
      await this.getAdminApiClient(edfiTenant)
        .get<GetApplicationDtoV2[], GetApplicationDtoV2[]>(
          `vendors/${vendorId}/applications?offset=0&limit=10000`
        )
        .catch((err) => {
          this.logger.error(
            `Error getting vendor applications for vendor ${vendorId} and tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }

  /**
   * Run the Admin API job to refresh the EdOrgs for the given environment. This is a long-running operation, so it returns a job ID that can be polled for completion.
   * @param sbEnvironment - The environment whose Admin API client to use
   * @returns Promise<string | null> - The job ID if successfully triggered, otherwise null
   */
  async triggerEdOrgRefresh(sbEnvironment: SbEnvironment): Promise<string | null> {
    return triggerEdOrgRefresh(
      this.getAdminApiClientForEnvironment(sbEnvironment),
      'odsInstances/edOrgs/refresh',
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
   * Retrieve all tenants with their ODS instances and education organizations
   * 
   * This method:
   * 1. Calls the root endpoint (GET /) to get tenancy information
   * 2. Determines tenant names based on multitenantMode setting
   * 3. For each tenant, calls /v2/tenants/{tenantName}/OdsInstances/edOrgs to get detailed information
   * 4. Maps the response to TenantDto format
   *
   * @param environment - SB Environment containing configuration
   * @returns Promise resolving to array of tenant objects with EdOrgs and OdsInstances
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
            500
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
          `Multi-tenant mode detected with ${tenantNames.length} tenants: ${tenantNames.join(', ')}`
        );
      } else {
        // Single-tenant mode
        tenantNames = ['default'];
        this.logger.log('Single-tenant mode detected, using default tenant');
      }

      // Log credential availability for discovered tenants
      const configPublic = environment.configPublic;
      const v2Config =
        'version' in configPublic && configPublic.version === 'v2' ? configPublic.values : undefined;
      const availableTenants = Object.keys(v2Config?.tenants || {});
      
      this.logger.log(
        `Discovered tenants from Admin API: [${tenantNames.join(', ')}]`
      );
      this.logger.log(
        `Tenants with credentials in environment config: [${availableTenants.join(', ')}]`
      );
      
      // Identify tenants without credentials
      const tenantsWithoutCredentials = tenantNames.filter(
        name => !availableTenants.includes(name)
      );
      if (tenantsWithoutCredentials.length > 0) {
        this.logger.warn(
          `WARNING: The following tenants were discovered but do NOT have credentials configured: ` +
          `[${tenantsWithoutCredentials.join(', ')}]. ` +
          `These tenants will be created with empty data. ` +
          `Add credentials to your environment configuration to sync their data.`
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
                `Add credentials for "${tenantName}" to your environment configuration to sync its data.`
              );
              throw new CustomHttpException(
                {
                  title: `Failed to authenticate tenant ${tenantName}`,
                  type: 'Error',
                  message: `${adminLogin.status}: ${errorMsg}. Add credentials for this tenant to sync its data.`,
                },
                500
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
              .get<TenantOdsInstancesEdOrgsResponse>(`tenants/${tenantName}/odsInstances/edOrgs`, {
                headers: {
                  Authorization: `Bearer ${token}`,
                  tenant: tenantName, // Add tenant header for multi-tenant API
                },
              })
              .catch((err) => {
                this.logger.error(
                  `Error getting details for tenant ${tenantName}: ${err.message}`
                );
                throw err;
              });

            // Extract data from response
            const details = response.data;

            this.logger.log(
              `Retrieved details for tenant ${tenantName} with ${details.odsInstances?.length || 0} ODS instances`
            );

            // Step 4: Map the response to TenantDto format
            // Use tenantName (URL identifier) as the stable tenant id and name
            const tenant: TenantDto = {
              id: tenantName,
              name: tenantName,
              odsInstances: details.odsInstances?.map((instance: AdminApiOdsInstance) => {
                const odsInstance: OdsInstanceDto = {
                  id: instance.id ?? null,
                  name: instance.name || 'Unknown ODS Instance',
                  instanceManageId: instance.odsInstanceManageId ?? null,
                  instanceType: instance.instanceType,
                  status: instance.status ?? null,
                  databaseTemplate: instance.databaseTemplate ?? null,
                  databaseName: instance.databaseName ?? null,
                  edOrgs: instance.educationOrganizations?.map((edOrg: AdminApiEducationOrganization) => {
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
            const errorMessage = detailsError instanceof Error 
              ? detailsError.message 
              : String(detailsError);
            const errorStack = detailsError instanceof Error 
              ? detailsError.stack 
              : undefined;
            
            // Extract more specific error information
            let specificReason = errorMessage;
            if ('response' in detailsError && typeof detailsError.response === 'object') {
              const response = detailsError.response as { message?: unknown };
              if (response.message) {
                specificReason = typeof response.message === 'string' 
                  ? response.message 
                  : JSON.stringify(response.message);
              }
            }
            
            this.logger.warn(
              `Failed to get details for tenant "${tenantName}": ${specificReason}. ` +
              `Returning tenant with empty ODS instances. ` +
              `This tenant will appear in the database but will have no data until credentials are added.`,
              errorStack
            );
            // Return tenant with empty details if the details endpoint fails
            return {
              id: tenantName,
              name: tenantName,
              odsInstances: [],
            };
          }
        })
      );

      return tenantsWithDetails;
    } catch (error) {
      // Only fall back to default tenant if the endpoint doesn't exist (404)
      // This allows older Admin API versions that don't support multi-tenancy to work
      if (isAxiosError(error) && error.response?.status === 404) {
        this.logger.warn(
          `Tenancy endpoint not found for environment ${environment.name} (404). Returning a default tenant for single-tenant API.`
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
        errorStack
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
        .get<OdsInstanceEdOrgsResponse[], OdsInstanceEdOrgsResponse[]>('odsInstances/edOrgs')
        .catch((err) => {
          this.logger.error(
            `Error getting Ed-Orgs for tenant ${edfiTenant.id}: ${err.message || err}`,
            err.stack
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
        }))
      );

      this.logger.log(
        `Successfully retrieved ${allEdOrgs.length} Ed-Orgs from ${response.length} ODS instance(s) for tenant ${edfiTenant.name}`
      );

      return allEdOrgs;
    } catch (error) {
      this.logger.error(
        `Failed to get all Ed-Orgs for tenant ${edfiTenant.name}: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }
}
