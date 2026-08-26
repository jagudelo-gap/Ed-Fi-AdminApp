import { SbEnvironment } from '@edanalytics/models-server';
import { PostSbEnvironmentDto, SbEnvironmentConfigPublic, TenantDto } from '@edanalytics/models';
import { SbSyncQueue } from '@edanalytics/models-server';
import { AdminApiServiceV1 } from '../teams/edfi-tenants/starting-blocks/v1/admin-api.v1.service';
import { AdminApiServiceV2 } from '../teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service';
import { AdminApiServiceV3 } from '../teams/edfi-tenants/starting-blocks/v3/admin-api.v3.service';

export type AnyAdminApiService = AdminApiServiceV1 | AdminApiServiceV2 | AdminApiServiceV3;

export interface BuildConfigPublicInput {
  createSbEnvironmentDto: PostSbEnvironmentDto;
  /** Raw ODS API metadata response, stored verbatim on configPublic.odsApiMeta */
  odsApiMetaResponse: unknown;
  tenantMode: 'MultiTenant' | 'SingleTenant';
}

export type DispatchSyncResult =
  | { kind: 'inline' }
  | { kind: 'queued'; syncQueue: SbSyncQueue };

/**
 * One implementation per Admin API specification version ('v1' | 'v2' | 'v3').
 * Replaces the scattered `version === 'v1'/'v2'` checks in
 * SbEnvironmentsEdFiService and AdminApiSyncService.
 */
export interface AdminApiVersionStrategy {
  readonly version: 'v1' | 'v2' | 'v3';
  /** v1 is always single-tenant; v2/v3 support multi-tenant mode. */
  readonly supportsMultiTenant: boolean;

  getAdminApiService(): AnyAdminApiService;

  /** Builds the version-shaped `configPublic` object for a brand-new environment. */
  buildConfigPublic(input: BuildConfigPublicInput): SbEnvironmentConfigPublic;

  /**
   * Builds the `values` patch to merge into `configPublic.values` when the ODS API
   * discovery URL changes on update.
   */
  applyOdsUrlUpdate(
    existingConfigPublic: SbEnvironmentConfigPublic,
    newOdsApiDiscoveryUrl: string
  ): Record<string, unknown>;

  /** Resolves the tenant-mode value the update-time lock check must match. */
  getTenantModeDefault(existingEnvironment: SbEnvironment): boolean;

  /** Whether a URL-affecting update should trigger a background re-sync. */
  shouldTriggerResync(hasUrlUpdates: boolean): boolean;

  /**
   * Runs (or enqueues) the tenant/ODS/EdOrg sync for a newly created or just-updated
   * environment. v1 runs inline and resolves immediately; v2/v3 enqueue a job and poll
   * for its terminal state.
   */
  dispatchSync(
    sbEnvironment: SbEnvironment,
    createSbEnvironmentDto?: PostSbEnvironmentDto
  ): Promise<DispatchSyncResult>;

  /** Builds the headers for the /connect/register call (adds `tenant` only when applicable). */
  getRegistrationHeaders(isMultitenant: boolean, tenant?: string): Record<string, string>;

  /** First-time credential provisioning before getTenants() can authenticate. No-op for v1. */
  bootstrapCredentials(sbEnvironment: SbEnvironment): Promise<void>;

  /** Registers credentials for tenants discovered by the API but not yet configured. No-op for v1. */
  provisionCredentialsForNewTenants(
    sbEnvironment: SbEnvironment,
    discoveredTenants: TenantDto[]
  ): Promise<void>;
}
