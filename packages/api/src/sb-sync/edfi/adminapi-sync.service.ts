import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { EdfiTenant, SbEnvironment } from '@edanalytics/models-server';
import { TenantDto, ISbEnvironmentConfigPrivateV2, ISbEnvironmentConfigPublicV2, ISbEnvironmentConfigPublicV3 } from '@edanalytics/models';
import { transformTenantData } from '../../utils/admin-api-data-adapter-utils';
import { persistSyncTenant } from '../sync-ods';
import { CacheService } from '../../app/cache.module';
import { AdminApiVersionStrategyFactory } from '../../admin-api-version-strategy';

export interface SyncResult {
  status: 'SUCCESS' | 'ERROR' | 'NO_ADMIN_API_CONFIG' | 'INVALID_VERSION';
  message?: string;
  tenantsProcessed?: number;
  error?: Error;
}

/** Shape of the `response` payload on a CustomHttpException / HttpException-like error. */
interface AdminApiErrorResponseBody {
  message?: string | string[];
  title?: string;
  type?: string;
}

/** Raw education organization shape as returned by the Admin API (v2/v3). */
interface RawAdminApiEducationOrganization {
  educationOrganizationId: number;
  nameOfInstitution: string;
  shortNameOfInstitution?: string;
  discriminator: string;
  parentId?: number;
}

/** Raw ODS instance / data store shape as returned by the Admin API (v2/v3). */
interface RawAdminApiOdsInstance {
  id?: number | null;
  odsInstanceManageId?: number | null;
  dataStoreManageId?: number | null;
  name?: string;
  instanceType?: string;
  dataStoreType?: string;
  status?: string | null;
  databaseTemplate?: string | null;
  databaseName?: string | null;
  educationOrganizations?: RawAdminApiEducationOrganization[];
}

/** Raw tenant details response as returned by the versioned Admin API client. */
interface RawAdminApiTenantDetails {
  id?: string;
  name?: string;
  odsInstances?: RawAdminApiOdsInstance[];
  dataStores?: RawAdminApiOdsInstance[];
}

@Injectable()
export class AdminApiSyncService {
  private readonly logger = new Logger(AdminApiSyncService.name);

  constructor(
    @InjectRepository(EdfiTenant)
    private edfiTenantsRepository: Repository<EdfiTenant>,
    @InjectRepository(SbEnvironment)
    private sbEnvironmentsRepository: Repository<SbEnvironment>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    @Inject(CacheService) private readonly cacheService: CacheService,
    private readonly strategyFactory: AdminApiVersionStrategyFactory
  ) {
  }

  /**
   * Flushes the in-process team ownership cache so that UI requests
   * immediately reflect ODS/EdOrg changes made by a sync operation.
   * The cache is keyed by teamId and rebuilt on the next request.
   */
  private flushOwnershipCache(): void {
    this.cacheService.flushAll();
    this.logger.log('Team ownership cache flushed after sync');
  }

  /**
   * Private helper method to process and persist a single tenant's data
   * Handles transformation and database persistence for both new and existing tenants
   * 
   * @param tenantData - The tenant data from Admin API
   * @param sbEnvironment - The parent SB Environment
   * @returns Promise<void>
   */
  private async processTenantData(tenantData: TenantDto, sbEnvironment: SbEnvironment): Promise<void> {
    this.logger.log(`Processing tenant: ${tenantData.name}`);
    this.logger.log(`Tenant has ${tenantData.odsInstances?.length || 0} ODS instances`);

    // Transform tenant data to EdfiTenant format
    const transformedData = transformTenantData(tenantData, sbEnvironment);

    this.logger.log(`Transformed data has ${transformedData.odss?.length || 0} ODS instances`);
    if (transformedData.odss && transformedData.odss.length > 0) {
      transformedData.odss.forEach((ods, idx) => {
        this.logger.log(
          `  ODS ${idx}: id=${ods.odsInstanceId}, name="${ods.odsInstanceName}", dbName="${ods.odsInstanceName}"`
        );
      });
    }

    // Find or create tenant in database
    // Use transformedData.name (normalized) for consistent lookups
    let edfiTenant = await this.edfiTenantsRepository.findOne({
      where: {
        name: transformedData.name,
        sbEnvironmentId: sbEnvironment.id,
      },
      relations: ['odss', 'odss.edorgs'],
    });

    if (!edfiTenant) {
      this.logger.log(`Creating new tenant: ${tenantData.name}`);
      edfiTenant = await this.edfiTenantsRepository.save({
        name: transformedData.name,
        sbEnvironmentId: sbEnvironment.id,
        created: new Date(),
      });
    } else {
      this.logger.log(`Found existing tenant: ${tenantData.name} (id=${edfiTenant.id})`);
      this.logger.log(`  Existing tenant has ${edfiTenant.odss?.length || 0} ODS instances`);
      if (edfiTenant.odss && edfiTenant.odss.length > 0) {
        edfiTenant.odss.forEach((ods, idx) => {
          this.logger.log(
            `    Existing ODS ${idx}: id=${ods.id}, odsInstanceId=${ods.odsInstanceId}, name="${ods.odsInstanceName}", dbName="${ods.dbName}"`
          );
        });
      }
    }

    // Sync ODS and EdOrgs using the delta-based persistSyncTenant approach.
    // This preserves existing primary keys for unchanged rows and only deletes rows
    // that are genuinely absent from the incoming data, avoiding unintended cascade deletes
    // on tables (e.g. Ownership, IntegrationApp) that reference Ods/Edorg via FK.
    this.logger.log(
      `Syncing ${transformedData.odss?.length || 0} ODS instance(s) for tenant: ${tenantData.name}`
    );

    await this.entityManager.transaction(async (em) => {
      // Map to SyncableOds format expected by persistSyncTenant
      const syncableOdss = (transformedData.odss ?? []).map(ods => ({
        id: ods.odsInstanceId,
        name: ods.odsInstanceName,
        dbName: ods.odsInstanceName || `ods-${ods.odsInstanceId}`,
        instanceManageId: ods.instanceManageId ?? null,
        instanceType: ods.instanceType ?? null,
        status: ods.status ?? null,
        databaseTemplate: ods.databaseTemplate ?? null,
        databaseName: ods.databaseName ?? null,
        edorgs: ods.edorgs?.map(edorg => ({
          educationorganizationid: edorg.educationOrganizationId,
          nameofinstitution: edorg.nameOfInstitution,
          shortnameofinstitution: edorg.shortNameOfInstitution || null,
          discriminator: edorg.discriminator,
          parent: edorg.parentId,
        })) || [],
      }));

      this.logger.log(`Calling persistSyncTenant with ${syncableOdss.length} syncable ODS`);
      await persistSyncTenant({ em, edfiTenant, odss: syncableOdss });
    });

    this.logger.log(`Successfully processed tenant: ${tenantData.name}`);
  }

  /**
   * Supports both v1 and v2 Admin API versions
   * 
   * @param sbEnvironment - The SB Environment to sync
   * @returns Promise<SyncResult> - Result containing status and processing details
   */
  async syncEnvironmentData(sbEnvironment: SbEnvironment): Promise<SyncResult> {
    this.logger.log(`Starting Admin API sync for environment: ${sbEnvironment.name}`);

    try {
      // Validate environment has necessary Admin API configuration
      if (!sbEnvironment.adminApiUrl) {
        this.logger.error(`Environment ${sbEnvironment.name} does not have Admin API URL configured`);
        return {
          status: 'NO_ADMIN_API_CONFIG',
          message: 'Admin API URL is not configured for this environment',
        };
      }

      // Determine API version and select the appropriate strategy
      let strategy;
      try {
        strategy = this.strategyFactory.getStrategy(sbEnvironment.version);
      } catch (error) {
        this.logger.error(`Environment ${sbEnvironment.name} has invalid or missing version: ${sbEnvironment.version}`);
        return {
          status: 'INVALID_VERSION',
          message: (error as Error).message,
        };
      }

      this.logger.log(`Environment ${sbEnvironment.name} is using Admin API version: ${strategy.version}`);

      // For brand-new environments (no stored credentials yet), register credentials
      // first so getTenants() can authenticate successfully.
      await strategy.bootstrapCredentials(sbEnvironment);
      const reloaded = await this.sbEnvironmentsRepository.findOne({ where: { id: sbEnvironment.id } });
      if (reloaded) sbEnvironment = reloaded;

      // Discover tenants from the Admin API
      this.logger.log(`Discovering tenants for environment: ${sbEnvironment.name}`);
      const adminApiService = strategy.getAdminApiService();
      const tenants: TenantDto[] = await adminApiService.getTenants(sbEnvironment);

      if (!tenants || tenants.length === 0) {
        this.logger.warn(`No tenants found for environment: ${sbEnvironment.name}`);
        return {
          status: 'SUCCESS',
          message: 'No tenants found to sync',
          tenantsProcessed: 0,
        };
      }

      this.logger.log(`Found ${tenants.length} tenant(s) for environment: ${sbEnvironment.name}`);

      // -----------------------------------------------------------------------
      // V2 path: use syncTenantData() per tenant so each request goes through
      // getAdminApiClient() — the only code path that correctly resolves
      // per-tenant credentials via the request interceptor.  Using getTenants()
      // bulk data directly caused the "wrong credentials / wrong data" issue
      // because it uses a manually-constructed client.
      // -----------------------------------------------------------------------
      if (strategy.version !== 'v1') {
        // Use the strategy's own tenant-mode resolution so v1 stays a hard false and
        // v2/v3 stay symmetric, instead of re-deriving it from configPublic here.
        const isMultiTenant = strategy.getTenantModeDefault(sbEnvironment);

        if (isMultiTenant) {
          // Provision credentials for tenants discovered by the API but not yet
          // in our config (newly discovered tenants).
          await strategy.provisionCredentialsForNewTenants(sbEnvironment, tenants);

          // Reload so syncTenantData (which re-reads sbEnvironment from DB per
          // tenant) picks up the freshly written credentials.
          const reloadedEnvironment = await this.sbEnvironmentsRepository.findOne({
            where: { id: sbEnvironment.id },
          });
          if (reloadedEnvironment) {
            sbEnvironment = reloadedEnvironment;
          }
        }

        // Trigger EdOrg refresh and poll for completion before fetching tenant data.
        // This is non-fatal: if the refresh fails or times out we still proceed with sync
        // (this does block the sync flow — up to ~ADMINAPI_REFRESH_POLL_ATTEMPTS *
        // ADMINAPI_REFRESH_POLL_INTERVAL_MS — but runs inside the background sync
        // consumer, not an HTTP request, so it doesn't block a user-facing call).
        const refreshJobId = await strategy.getAdminApiService().triggerEdOrgRefresh(sbEnvironment);
        if (refreshJobId) {
          const jobStatus = await strategy.getAdminApiService().pollJobStatus(sbEnvironment, refreshJobId);
          if (jobStatus === 'failed') {
            this.logger.error(
              `EdOrg refresh job ${refreshJobId} failed — syncing with potentially stale data`
            );
          } else if (jobStatus === 'timeout') {
            this.logger.warn(
              `EdOrg refresh job ${refreshJobId} timed out — proceeding with sync`
            );
          }
        }

        // Ensure an EdfiTenant row exists for every tenant the API returned,
        // then delegate to syncTenantData which uses getAdminApiClient().
        let processedCount = 0;
        for (const tenantData of tenants) {
          try {
            let edfiTenant = await this.edfiTenantsRepository.findOne({
              where: { name: tenantData.name, sbEnvironmentId: sbEnvironment.id },
            });
            if (!edfiTenant) {
              this.logger.log(`Creating EdfiTenant row for newly discovered tenant: ${tenantData.name}`);
              edfiTenant = await this.edfiTenantsRepository.save({
                name: tenantData.name,
                sbEnvironmentId: sbEnvironment.id,
                created: new Date(),
              });
            }

            // syncTenantData fetches ODS data via getAdminApiClient() — credentials
            // and the tenant header are managed by the request interceptor, ensuring
            // each tenant only receives its own data.
            const result = await this.syncTenantData(edfiTenant);
            if (result.status === 'SUCCESS') {
              processedCount++;
            } else {
              this.logger.error(
                `Sync failed for tenant ${tenantData.name}: ${result.message}`
              );
            }
          } catch (tenantError) {
            this.logger.error(
              `Error processing tenant ${tenantData.name}: ${tenantError.message}`,
              tenantError.stack
            );
          }
        }

        this.logger.log(
          `Admin API v2 sync completed for environment: ${sbEnvironment.name}. ` +
          `Processed ${processedCount}/${tenants.length} tenant(s)`
        );

        // Remove tenants that exist in the DB but were not returned by the API.
        // Their ODS and EdOrgs cascade-delete via FK (onDelete: 'CASCADE').
        const apiTenantNamesV2 = new Set(tenants.map(t => t.name));
        const dbTenantsV2 = await this.edfiTenantsRepository.find({
          where: { sbEnvironmentId: sbEnvironment.id },
        }) ?? [];
        const orphanedV2Ids = dbTenantsV2
          .filter(t => !apiTenantNamesV2.has(t.name))
          .map(t => t.id);
        if (orphanedV2Ids.length > 0) {
          this.logger.log(
            `Removing ${orphanedV2Ids.length} orphaned tenant(s): ` +
            dbTenantsV2.filter(t => !apiTenantNamesV2.has(t.name)).map(t => t.name).join(', ')
          );
          await this.edfiTenantsRepository.delete(orphanedV2Ids);
        }

        this.flushOwnershipCache();
        return {
          status: 'SUCCESS',
          message: `Successfully synced ${processedCount} of ${tenants.length} tenant(s)`,
          tenantsProcessed: processedCount,
        };
      }

      // -----------------------------------------------------------------------
      // V1 path: single-tenant, use processTenantData directly with the data
      // already fetched by getTenants() (no per-tenant credential split needed).
      // -----------------------------------------------------------------------
      let processedCount = 0;
      for (const tenantData of tenants) {
        try {
          await this.processTenantData(tenantData, sbEnvironment);
          processedCount++;
        } catch (tenantError) {
          this.logger.error(
            `Error processing tenant ${tenantData.name}: ${tenantError.message}`,
            tenantError.stack
          );
        }
      }

      this.logger.log(
        `Admin API v1 sync completed for environment: ${sbEnvironment.name}. ` +
        `Processed ${processedCount}/${tenants.length} tenant(s)`
      );

      // Remove tenants in DB that the API no longer returns.
      const apiTenantNames = new Set(tenants.map(t => t.name));
      const dbTenants = await this.edfiTenantsRepository.find({
        where: { sbEnvironmentId: sbEnvironment.id },
      }) ?? [];
      const orphanedTenantIds = dbTenants
        .filter(t => !apiTenantNames.has(t.name))
        .map(t => t.id);
      if (orphanedTenantIds.length > 0) {
        this.logger.log(
          `Removing ${orphanedTenantIds.length} orphaned tenant(s) no longer returned by Admin API: ` +
          dbTenants.filter(t => !apiTenantNames.has(t.name)).map(t => t.name).join(', ')
        );
        await this.edfiTenantsRepository.delete(orphanedTenantIds);
      }

      this.flushOwnershipCache();
      return {
        status: 'SUCCESS',
        message: `Successfully synced ${processedCount} of ${tenants.length} tenant(s)`,
        tenantsProcessed: processedCount,
      };
    } catch (error) {
      // Extract detailed error information
      let errorMessage = 'Unknown error occurred';
      let errorDetails = '';

      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Check if it's a CustomHttpException with additional details
        if ('response' in error && typeof error.response === 'object' && error.response !== null) {
          const response = error.response as AdminApiErrorResponseBody;
          if (response.message) {
            errorDetails = Array.isArray(response.message)
              ? response.message.join(', ')
              : response.message;
          }
          if (response.title) {
            errorMessage = response.title;
          }
        }
      }

      const fullMessage = errorDetails ? `${errorMessage}: ${errorDetails}` : errorMessage;

      this.logger.error(
        `Failed to sync environment ${sbEnvironment.name}: ${fullMessage}`,
        error instanceof Error ? error.stack : String(error)
      );
      
      return {
        status: 'ERROR',
        message: fullMessage,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Syncs tenant-specific data including ODS instances and education organizations
   * Only supports v2 Admin API (multi-tenant mode)
   * For v1 environments, use syncEnvironmentData instead
   * 
   * @param edfiTenant - The EdFi tenant to sync
   * @returns Promise<SyncResult> - Result containing status and processing details
   */
  async syncTenantData(edfiTenant: EdfiTenant): Promise<SyncResult> {
    this.logger.log(`Starting tenant sync for: ${edfiTenant.name}`);

    try {
      // Load the tenant with its parent environment
      const tenantWithEnvironment = await this.edfiTenantsRepository.findOne({
        where: { id: edfiTenant.id },
        relations: ['sbEnvironment'],
      });

      if (!tenantWithEnvironment || !tenantWithEnvironment.sbEnvironment) {
        this.logger.error(`Tenant ${edfiTenant.name} not found or missing environment`);
        return {
          status: 'ERROR',
          message: 'Tenant not found or missing environment',
        };
      }

      const sbEnvironment = tenantWithEnvironment.sbEnvironment;

      // Validate environment has necessary Admin API configuration
      if (!sbEnvironment.adminApiUrl) {
        this.logger.error(`Environment for tenant ${edfiTenant.name} does not have Admin API URL configured`);
        return {
          status: 'NO_ADMIN_API_CONFIG',
          message: 'Admin API URL is not configured for this tenant\'s environment',
        };
      }

      // Determine API version and select the appropriate strategy
      let strategy;
      try {
        strategy = this.strategyFactory.getStrategy(sbEnvironment.version);
      } catch (error) {
        this.logger.error(`Environment for tenant ${edfiTenant.name} has invalid version: ${sbEnvironment.version}`);
        return {
          status: 'INVALID_VERSION',
          message: (error as Error).message,
        };
      }

      // V1 is single-tenant, so individual tenant sync is not supported
      if (strategy.version === 'v1') {
        this.logger.warn(`Tenant sync not supported for v1 environments. Use environment-level sync instead.`);
        return {
          status: 'ERROR',
          message: 'V1 Admin API is single-tenant. Use syncEnvironmentData to sync all data.',
        };
      }

      this.logger.log(`Syncing tenant ${edfiTenant.name} using Admin API ${strategy.version}`);

      // Validate that credentials exist for this tenant in the environment configuration
      const configPublic = sbEnvironment.configPublic;
      const configPrivate = sbEnvironment.configPrivate;
      const tenantConfig =
        'version' in configPublic && configPublic.version === strategy.version
          ? (configPublic.values as ISbEnvironmentConfigPublicV2 | ISbEnvironmentConfigPublicV3)
          : undefined;
      const tenantConfigPrivateAll =
        'version' in configPublic && configPublic.version === strategy.version
          ? (configPrivate as ISbEnvironmentConfigPrivateV2)
          : undefined;

      if (!tenantConfig || !tenantConfigPrivateAll) {
        this.logger.error(`Environment configuration is not ${strategy.version} format for tenant ${edfiTenant.name}`);
        return {
          status: 'ERROR',
          message: `Environment is not configured for Admin API ${strategy.version}`,
        };
      }

      // Check if credentials exist for this specific tenant
      const tenantConfigPublic = tenantConfig?.tenants?.[edfiTenant.name];
      const tenantConfigPrivate = tenantConfigPrivateAll?.tenants?.[edfiTenant.name];

      if (!tenantConfigPublic || !tenantConfigPrivate) {
        const availableTenants = Object.keys(tenantConfig?.tenants || {});
        this.logger.error(
          `No credentials found for tenant "${edfiTenant.name}" in environment "${sbEnvironment.name}". ` +
          `Available tenants with credentials: [${availableTenants.join(', ')}]`
        );
        return {
          status: 'ERROR',
          message: `Tenant "${edfiTenant.name}" does not have credentials configured in this environment.\n\n` +
            `Available tenants: ${availableTenants.length > 0 ? availableTenants.join(', ') : '(none)'}\n\n` +
            `This usually means:\n` +
            `1. The tenant was discovered from the Admin API but you don't have credentials for it\n` +
            `2. The tenant name doesn't exactly match the credentials key (check spelling/case)\n` +
            `3. The tenant was deleted from the Admin API but still exists in the database\n\n` +
            `To fix this:\n` +
            `- Add credentials for "${edfiTenant.name}" to your environment configuration\n` +
            `- Or run environment-level sync to clean up orphaned tenants\n` +
            `- Or delete this tenant from the database if it no longer exists in the Admin API`,
        };
      }

      if (!tenantConfigPublic.adminApiKey || !tenantConfigPrivate.adminApiSecret) {
        this.logger.error(`Incomplete credentials for tenant ${edfiTenant.name}`);
        return {
          status: 'ERROR',
          message: `Tenant "${edfiTenant.name}" is missing adminApiKey or adminApiSecret in the environment configuration.`,
        };
      }

      this.logger.log(`Credentials validated for tenant ${edfiTenant.name}`);

      // Fetch tenant details using the version-appropriate client and endpoint
      const versionedApiService = strategy.getAdminApiService();
      const endpoint =
        strategy.version === 'v3'
          ? `tenants/${edfiTenant.name}/dataStores/edOrgs`
          : `tenants/${edfiTenant.name}/odsInstances/edOrgs`;

      this.logger.log(`Fetching tenant details from Admin API: ${endpoint}`);

      let tenantDetails: RawAdminApiTenantDetails;
      try {
        // Use getAdminApiClient with tenantWithEnvironment to ensure tenant-specific authentication
        tenantDetails = await versionedApiService.getAdminApiClient(tenantWithEnvironment)
          .get(endpoint);
      } catch (apiError) {
        this.logger.error(
          `Failed to retrieve tenant details from Admin API: ${apiError.message}`,
          apiError.stack
        );
        return {
          status: 'ERROR',
          message: `Admin API call failed: ${apiError.message}`,
          error: apiError,
        };
      }

      if (!tenantDetails) {
        this.logger.warn(`No details returned for tenant: ${edfiTenant.name}`);
        return {
          status: 'SUCCESS',
          message: 'No tenant details found',
        };
      }

      const rawInstances =
        strategy.version === 'v3' ? tenantDetails.dataStores : tenantDetails.odsInstances;

      this.logger.log(
        `Retrieved ${rawInstances?.length || 0} ODS instance(s) for tenant: ${edfiTenant.name}`
      );

      // Transform the response to TenantDto format
      const tenantDto: TenantDto = {
        id: tenantDetails.id || edfiTenant.name,
        name: tenantDetails.name || edfiTenant.name,
        odsInstances: (rawInstances || []).map((instance: RawAdminApiOdsInstance) => ({
          id: instance.id ?? null,
          instanceManageId: instance.odsInstanceManageId ?? instance.dataStoreManageId ?? null,
          name: instance.name || 'Unknown ODS Instance',
          instanceType: instance.instanceType ?? instance.dataStoreType,
          status: instance.status ?? null,
          databaseTemplate: instance.databaseTemplate ?? null,
          databaseName: instance.databaseName ?? null,
          edOrgs: (instance.educationOrganizations || []).map((edOrg: RawAdminApiEducationOrganization) => ({
            instanceId: instance.id,
            instanceName: instance.name,
            educationOrganizationId: edOrg.educationOrganizationId,
            nameOfInstitution: edOrg.nameOfInstitution,
            shortNameOfInstitution: edOrg.shortNameOfInstitution,
            discriminator: edOrg.discriminator,
            parentId: edOrg.parentId,
          })),
        })),
      };

      // Use the shared helper to process the tenant data
      await this.processTenantData(tenantDto, sbEnvironment);

      this.logger.log(`Successfully synced tenant: ${edfiTenant.name}`);
      this.flushOwnershipCache();

      return {
        status: 'SUCCESS',
        message: `Successfully synced ${tenantDto.odsInstances?.length || 0} ODS instance(s)`,
      };
    } catch (error) {
      // Extract detailed error information
      let errorMessage = 'Unknown error occurred';
      let errorDetails = '';

      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Check if it's a CustomHttpException or HttpException with additional details
        if ('response' in error && typeof error.response === 'object' && error.response !== null) {
          const response = error.response as AdminApiErrorResponseBody;

          // Extract message details
          if (response.message) {
            if (typeof response.message === 'string') {
              errorDetails = response.message;
            } else if (Array.isArray(response.message)) {
              errorDetails = response.message.join(', ');
            } else if (typeof response.message === 'object') {
              errorDetails = JSON.stringify(response.message);
            }
          }
          
          // Use title as the primary error message if available
          if (response.title && typeof response.title === 'string') {
            errorMessage = response.title;
          }
          
          // Include type information if available
          if (response.type && typeof response.type === 'string') {
            errorMessage = `[${response.type}] ${errorMessage}`;
          }
        }
      }

      const fullMessage = errorDetails ? `${errorMessage}: ${errorDetails}` : errorMessage;

      this.logger.error(
        `Failed to sync tenant ${edfiTenant.name}: ${fullMessage}`,
        error instanceof Error ? error.stack : String(error)
      );
      
      return {
        status: 'ERROR',
        message: fullMessage,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}