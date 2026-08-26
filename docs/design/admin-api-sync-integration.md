# Design: Admin API Sync Integration

## Feature

Context: Ed-Fi Admin App running outside of a Starting Blocks Environment.

User Story: _As a system administrator, I want to synchronize the Admin App database's list of tenants, education organizations, ODS instances, and other information with the actual deployed state, so that the user interface can be more responsive and provide better validation for my requests_.

Feature Name: environment synchronization.

## Overview

This document outlines the design for integrating direct Admin API data
retrieval into the existing SB Sync job scheduler. The enhancement adds
conditional sync processing where environments with `startingBlocks: false` will
use Admin API endpoints instead of Lambda functions, while maintaining full
compatibility with existing database schemas.

## Current Architecture

### Existing Sync Flow

1. **Scheduler Job** → Discovers environments with metadata configuration
2. **Environment Sync** → Currently uses Lambda functions exclusively
3. **Version Detection** → Determines SB v1 vs v2
4. **Data Processing** → Stores data in existing table structures

### Current Conditional Logic

```typescript
// refreshSbEnvironment: first tries Starting Blocks (Lambda ARN), then Admin API
let sbEnvironment = await this.sbEnvironmentsRepository
  .createQueryBuilder()
  .select()
  .where(`"configPublic"->>'sbEnvironmentMetaArn' is not null and id = :id`, { id: sbEnvironmentId })
  .getOne();

if (sbEnvironment === null) {
  // Fallback: non-Starting Blocks environment identified by adminApiUrl presence
  sbEnvironment = await this.sbEnvironmentsRepository
    .createQueryBuilder()
    .select()
    .where(`"configPublic"->>'adminApiUrl' is not null and id = :id`, { id: sbEnvironmentId })
    .getOne();
  if (sbEnvironment === null)
    throw new NotFoundException(`No syncable environment found with id ${sbEnvironmentId}`);

  // Route to Admin API sync service
  const adminApiSyncResult = await this.adminapiSyncService.syncEnvironmentData(sbEnvironment);
  // ...
}
```

**Tenant-Level Routing (`refreshEdfiTenant`):**

Individual tenant sync checks the `sbEnvironment.startingBlocks` boolean flag:

```typescript
if (!sbEnvironment.startingBlocks) {
  // Use Admin API sync for non-Starting Blocks tenants
  const result = await this.adminapiSyncService.syncTenantData(edfiTenant);
} else {
  // Use Lambda-based sync for Starting Blocks tenants
}
```

### PgBoss Job Channels

Three channels drive the sync pipeline:

| Channel | Constant | Purpose |
|---------|----------|---------|
| `sbe-sync-scheduler` | `SYNC_SCHEDULER_CHNL` | CRON-triggered; discovers environments to sync |
| `sbe-sync` | `ENV_SYNC_CHNL` | Environment-level sync job |
| `edfi-tenant-sync` | `TENANT_SYNC_CHNL` | Tenant-level sync job |

> **Important:** The scheduled CRON job (`SYNC_SCHEDULER_CHNL`) **only** queues environments with `sbEnvironmentMetaArn` (Starting Blocks Lambda environments). Admin API environments are synced only when `ENV_SYNC_CHNL` is explicitly triggered — for example, via the UI sync button or a direct API call.

## Proposed Design Changes

### 1. Enhanced Conditional Sync Logic

#### Modified Consumer Flow

```typescript
// Enhanced conditional sync logic with proper routing
async refreshSbEnvironment(environmentId: number) {
  const environment = await this.sbEnvironmentsRepository.findOne({
    where: { id: environmentId }
  });
  
  if (!environment) {
    throw new NotFoundException(`Environment not found with id ${environmentId}`);
  }

  // Key enhancement: Check startingBlocks flag first
  const isStartingBlocks = environment.configPublic?.startingBlocks === true;
  
  if (isStartingBlocks && environment.configPublic?.sbEnvironmentMetaArn) {
    // Use existing Lambda-based sync for Starting Blocks environments    
  } else {
    // Use new Admin API-based sync for non-Starting Blocks environments   
  }
}
```

### 2. New AdminApiSyncService

#### Core Service Implementation

**AdminApiSyncService Core Implementation:**

• **Service Constructor:**

- Resolve dependencies for Admin API services (v1 and v2)
- Initialize entity managers and repositories
- Set up logging capabilities

• **`SyncResult` Interface:**

```typescript
export interface SyncResult {
  status: 'SUCCESS' | 'ERROR' | 'NO_ADMIN_API_CONFIG' | 'INVALID_VERSION';
  message?: string;
  tenantsProcessed?: number;
  error?: Error;
}
```

• **Main Sync Method - `syncEnvironmentData()`:**

- **Purpose:** Main entry point for Admin API-based environment synchronization
- **Supports:** Both v1 and v2 Admin API versions
- **V1 Process Flow:**
  - Validate environment has `adminApiUrl` configured
  - Determine version (`v1`/`v2`) and select appropriate service
  - Call `getTenants()` which fetches ODS instances from `v1/odsInstances`
  - Call `processTenantData()` directly for each tenant
  - Remove any orphaned DB tenants not returned by the API
- **V2 Process Flow:**
  - Validate environment has `adminApiUrl` configured
  - Call `getTenants()` which queries root endpoint for tenant discovery
  - If `MultiTenant` mode: call `provisionCredentialsForNewTenants()` for any newly discovered tenants, then reload the environment from DB
  - For each discovered tenant, ensure an `EdfiTenant` DB row exists, then call `syncTenantData()` (which uses `getAdminApiClient()` for proper per-tenant credential resolution)
  - Remove any orphaned DB tenants not returned by the API
- **Return Value:** Returns `SyncResult` with status and `tenantsProcessed` count

• **Tenant Sync Method - `syncTenantData()`:**

- **Purpose:** Syncs tenant-specific data including ODS instances and education organizations for individual tenants
- **Scope:** Public method for individual tenant synchronization (v2 only)
- **Credential Validation:** Before calling the Admin API, validates that `adminApiKey` and `adminApiSecret` exist for the tenant in the environment config. Returns a detailed error message with remediation guidance if credentials are missing.
  - **Operations:**
    - Validate tenant has environment with Admin API configuration
    - Use `getAdminApiClient` with tenant context for proper authentication
    - Retrieve ODS instances for the specified tenant
    - Get education organizations for each ODS instance
    - Transform and store data in existing structures without schema changes
    - Return processed sync result with status
- **Authentication:** Uses tenant-specific credentials and includes tenant header in API requests

• **Helper Method - `processTenantData()`:**

- **Purpose:** Private helper to process and persist a single tenant's data using the delta-based sync approach
- **Strategy:** **Delta-based sync** — delegates entirely to `persistSyncTenant()`, which calls `computeOdsListDeltas()` internally. Only rows that are genuinely absent from the incoming API response are deleted; unchanged rows keep their primary keys, avoiding unintended cascade deletes on tables (e.g. `Ownership`, `IntegrationApp`) that reference `Ods`/`Edorg` via FK. This is the same strategy used by the Starting Blocks Lambda path.
- **Operations:**
  - Transform tenant data to `EdfiTenant` format via `transformTenantData()`
  - Find or create tenant in database
  - Within a transaction: call `persistSyncTenant()` with the incoming ODS data — delta computation handles inserts, updates, and targeted deletes

• **Private Method - `provisionCredentialsForNewTenants()`:**

- **Purpose:** Auto-provisions Admin API OAuth client credentials for tenants discovered by the API that do not yet have credentials in the environment config
- **Scope:** Only applicable to v2 MultiTenant environments
- **Process:**
  - Compares discovered tenant names from API against existing tenant keys in `configPublic.values.tenants`
  - For each new tenant, calls `createClientCredentials()` to register a new OAuth client
  - Stores generated `clientId` in `configPublic` and `clientSecret` in `configPrivate`
  - Saves the updated `SbEnvironment` to the database so subsequent `syncTenantData()` calls can resolve credentials
- **Error Handling:** Failures for individual tenants are logged and skipped; the sync continues for remaining tenants

• **Private Method - `createClientCredentials()`:**

- **Purpose:** Registers a new OAuth client with the Admin API via `POST /connect/register`
- **Parameters:** `adminApiUrl`, `tenantName`, `isMultiTenant`
- **Returns:** `{ clientId: string; clientSecret: string; displayName: string }`
- **Credential Generation:**
  - `clientId`: String of the form `client_${randomUUID()}` (a UUID generated with `randomUUID()` and prefixed with `client_`)
  - `clientSecret`: 32-byte cryptographically random string from an alphanumeric + symbol charset
  - `displayName`: `AdminApp-v4-{4-char-random-suffix}`
- **Multi-Tenant Header:** Includes `tenant: {tenantName}` header when `isMultiTenant = true`
- **Error Handling:** Provides specific message for 400 responses indicating the tenant is not configured in Admin API

```typescript

export class AdminApiSyncService {
  constructor(
    // Resolve dependencies
  ) {}

  async syncEnvironmentData(sbEnvironment: SbEnvironment): Promise<SyncResult> {
    // Validate environment has adminApiUrl
    // Select v1/v2 service, discover tenants
    // V2 + MultiTenant: provisionCredentialsForNewTenants(), reload env
    // V2: call syncTenantData() per tenant via getAdminApiClient()
    // V1: call processTenantData() directly
    // Both: remove orphaned DB tenants not in API response
  }

  async syncTenantData(edfiTenant: EdfiTenant): Promise<SyncResult> {
    // Validate credentials exist for tenant
    // Fetch from tenants/{name}/OdsInstances/edOrgs via getAdminApiClient()
    // Call processTenantData() with API response
  }

  private async processTenantData(tenantData: TenantDto, sbEnvironment: SbEnvironment): Promise<void> {
    // Find or create EdfiTenant in DB
    // Transaction: delete all EdOrgs → delete all ODS → persistSyncTenant() with fresh data
  }

  private async provisionCredentialsForNewTenants(sbEnvironment: SbEnvironment, discoveredTenants: TenantDto[]): Promise<void> {
    // For each new tenant (in API but not in config): createClientCredentials()
    // Store clientId in configPublic, clientSecret in configPrivate
    // Save updated SbEnvironment to DB
  }

  private async createClientCredentials(adminApiUrl: string, tenantName: string, isMultiTenant: boolean): Promise<{ clientId: string; clientSecret: string; displayName: string }> {
    // POST /connect/register with generated credentials
    // Include tenant header if isMultiTenant
  }
}
```

### 3. Authentication and Token Management

#### Tenant-Specific Token Storage

**Multi-Tenant Authentication Pattern:**

• **Composite Token Keys:**
  - **Pattern:** `${environmentId}-${tenantName}`
  - **Purpose:** Each tenant maintains its own OAuth token to prevent credential sharing
  - **Implementation:** `getTenantTokenKey(environmentId, tenantName)` helper method
  - **Example:** Environment 123 with tenant1 uses key `123-tenant1`

• **Token Cache Management:**
  - **Storage:** NodeCache with automatic expiration based on token lifetime
  - **TTL:** Token expiry time minus 60 seconds for refresh buffer
  - **Isolation:** Prevents token collision between tenants in same environment

• **Login Method Enhancement:**
  - **Parameter:** `tenantName` parameter added to `login()` method
  - **Auto-Selection:** When no tenant specified, automatically selects first available tenant (prefers 'default')
  - **Storage:** Stores token using composite key for tenant-specific authentication
  - **Logging:** Records token storage with composite key for debugging

#### API Client Methods

**`getAdminApiClient(edfiTenant)`:**
- **Purpose:** Creates authenticated client for tenant-specific operations
- **Token Retrieval:** Uses composite key `${sbEnvironment.id}-${tenantName}`
- **Auto-Authentication:** Automatically logs in if token not found or expired
- **Headers:** Includes both `Authorization: Bearer {token}` and `tenant: {tenantName}`
- **Use Case:** All tenant-specific API operations (ODS instances, education organizations, etc.)

**`getAdminApiClientUsingEnv(environment)`:**
- **Purpose:** Creates authenticated client for environment-level operations
- **Token Retrieval:** Uses environment ID only
- **Limited Scope:** Used only for root endpoint (`/`) to check tenancy mode
- **Note:** Does NOT include tenant header - only for multi-tenant discovery

#### Authentication Flow

**Environment-Level Sync:**
1. Check tenancy mode using environment-level token (no tenant header)
2. Discover tenant names from API response
3. **For each tenant:**
   - Authenticate separately with tenant-specific credentials
   - Store token using composite key `${environmentId}-${tenantName}`
   - Fetch tenant data with tenant-specific token and tenant header

**Tenant-Level Sync:**
1. Retrieve tenant with environment relationship
2. Use `getAdminApiClient(tenant)` for automatic tenant-specific authentication
3. Include tenant header in all API requests
4. Fetch ODS instances and education organizations with proper tenant context

#### Multi-Tenant API Requirements

• **Tenant Header Requirement:**
  - **All Tenant-Specific Endpoints:** Must include `tenant: {tenantName}` header
  - **Examples:** `/tenants/{name}/OdsInstances/edOrgs`, ODS operations, education organizations
  - **Exception:** Root endpoint (`/`) for tenancy discovery does not require tenant header

• **Authentication Isolation:**
  - **Per-Tenant Credentials:** Each tenant has separate API key and secret
  - **Token Separation:** No token sharing between tenants prevents data leakage
  - **Authorization Boundary:** Each token only authorized for its specific tenant

### 4. Extended Admin API Service Methods

#### AdminApiServiceV1 Extensions

**AdminApiServiceV1 `getTenants()` Method:**

• **Actual Implementation:** V1's `getTenants()` method queries `GET v1/odsInstances` directly using the environment-level admin API client. It does **not** use separate `getEducationOrganizations()` or `getOdsInstancesForDefaultTenant()` methods for sync purposes.

• **Education Organizations:** V1 sync does **not** populate education organizations — `edOrgs` is always returned as an empty array `[]` for V1. The Admin API v1 does not expose an endpoint that efficiently provides EdOrgs alongside ODS instances.

• **Default Tenant Construction:** V1 wraps the ODS instances in a single `TenantDto` using the environment name as the tenant name:

```typescript
const defaultTenant: TenantDto = {
  id: 'default',
  name: environment.name || 'Default Tenant',
  odsInstances: mappedOdsInstances, // from v1/odsInstances
};
return [defaultTenant];
```

• **`getTenants()` Method Summary:**

- **Parameters:** `environment: SbEnvironment`
- **Returns:** `Promise<TenantDto[]>` — always a single-element array
- **Admin API Endpoint:** `GET /v1/odsInstances`
- **ODS Fields Mapped:** `id` → `OdsInstanceDto.id`, `name` → `OdsInstanceDto.name`, `instanceType` → `OdsInstanceDto.instanceType`
- **EdOrgs:** Always empty (`[]`) in V1 sync

#### AdminApiServiceV2 Extensions

**AdminApiServiceV2 Key Differences from V1:**

• **`getTenants()` Method - Primary Difference:**

- **V2 Advantage:** Queries tenancy information from root endpoint, then fetches detailed data per tenant
- **Endpoints:** 
  - `GET /` - Root endpoint for tenancy mode and tenant list discovery
  - `GET /v2/tenants/{tenantName}/OdsInstances/edOrgs` - Per-tenant details endpoint
- **Multi-Tenant Support:** Handles environments with multiple tenants
- **Parameters:** `environment: SbEnvironment`
- **Returns:** `Promise<TenantDto[]>`
- **Implementation Steps:**
  1. Call root endpoint to determine multi-tenant mode and get tenant names
  2. **Per-Tenant Authentication:** Login separately for each tenant using tenant-specific credentials
  3. **Parallel Fetch:** Use `Promise.all()` to fetch all tenant details concurrently
  4. **Tenant Context:** Include `tenant` header in each API request
  5. Transform response data including ODS instances and education organizations
- **Error Handling:** Gracefully handles per-tenant failures, returns tenant with empty details on error
- **Contrast with V1:** V1 creates default tenant from config, V2 fetches actual tenants from API with proper multi-tenant authentication

• **Shared Methods with V1 (Same Implementation Pattern):**

- **`getEducationOrganizations()` Method:**
  - **Same Purpose:** Retrieve education organizations for tenant
  - **Same API Pattern:** Uses `/{version}/educationOrganizations` endpoints
  - **Same Filtering:** Optional ODS instance filtering available
  - **Authentication:** Uses tenant-specific token via `getAdminApiClient(tenant)`

- **`getOdsInstancesForTenant()` Method:**
  - **Same Purpose:** Retrieve ODS instances for tenant
  - **Same API Pattern:** Uses ODS instances endpoints
  - **Same Data Handling:** Returns instance details with metadata
  - **Authentication:** Uses tenant-specific token via `getAdminApiClient(tenant)`

• **V1 vs V2 Summary:**

- **Primary Difference:** Tenant discovery (V2 uses root API endpoint, V1 queries `v1/odsInstances` directly)
- **Education Organizations:** V2 populates EdOrgs per tenant; V1 returns empty EdOrgs
- **Authentication Model:** V2 requires per-tenant authentication with composite token keys; V1 uses a single environment-level token
- **API Headers:** V2 requires `tenant` header for all tenant-specific operations; V1 does not use tenant header
- **Shared Functionality:** Both versions use the same `persistSyncTenant()` pipeline for persisting ODS and EdOrg data
- **Data Processing:** Both versions use the same data transformation logic to map API responses to the existing database schema

### 5. Data Transformation and Mapping

#### Adapting Admin API Responses to Existing Tables

**`transformTenantData()` — Standalone Utility Function:**

This function lives in `packages/api/src/utils/admin-api-data-adapter-utils.ts` as a standalone exported function (not a class). It is imported directly by `AdminApiSyncService`.

• **Signature:** `transformTenantData(apiTenants: TenantDto, sbEnvironment: SbEnvironment): Partial<EdfiTenant>`

• **`transformTenantData()` Method:**

- **Purpose:** Transform Admin API tenant response to match EdfiTenant entity
- **Input Parameters:**
  - `tenantDto: TenantDto` - Admin API tenant response with ODS instances and education organizations
  - `sbEnvironment: SbEnvironment` - Environment context
- **Returns:** `Transformed tenant data` with nested ODS and education organization structures
- **Key Transformations:**
  - Maps `tenantDto.name` to tenant name field
  - Links tenant to environment via `sbEnvironment.id`
  - Processes ODS instances with their education organizations
  - Handles date conversion with fallback to current date
- **Schema Compatibility:** Maps v2 multi-tenant structure to existing database schema

• **`transformOdsInstanceData()` / ODS Instance Mapping:**

- **Purpose:** Transform Admin API ODS instance to match existing Ods entity structure
- **Input:** ODS instance data from Admin API response
- **Returns:** `SyncableOds` - Mapped ODS instance entity
- **Field Mappings:**
  - **Stable Identifier:** `odsInstanceId` (used for matching existing records)
  - Direct mapping: `name` → `odsInstanceName`
  - Computed: `dbName` (typically matches instance name)
  - Initialized: `edorgs` array populated from education organizations
- **Matching Strategy:** Uses `odsInstanceId` as the stable key for identifying existing ODS records
- **Change Detection:** Compares `odsInstanceName` to detect name changes
- **Update Logic:** 
  - Finds existing ODS by `odsInstanceId`
  - Updates `odsInstanceName` if changed
  - Preserves `dbName` from original creation

• **`transformEdorgData()` Method:**

- **Purpose:** Transform Admin API education organizations to match existing Edorg entity
- **Input:** Education organization data from API response
- **Returns:** `Edorg data` - Mapped education organization entity
- **Field Preservation Strategy:**
  - Core identifiers: `educationOrganizationId`, `discriminator`
  - Institution names: `nameOfInstitution`, `shortNameOfInstitution`
  - Hierarchy: `parentId` for organization relationships
  - Fallback logic: Uses `nameOfInstitution` if `shortNameOfInstitution` missing
- **Data Integrity:** Preserves all required fields for existing table structure

#### Sync Delta Computation

**Dual ODS Matching Strategy:**

`computeOdsListDeltas()` (in `sync-ods.ts`) supports two matching strategies to handle both V2 Admin API responses and legacy SB V1 Lambda responses:

| Matching Strategy | When Used | Key Field |
|---|---|---|
| By `odsInstanceId` | V2 Admin API and non-SB V1 ODS from admin form | `odsInstanceId` (numeric) |
| By `dbName` | SB V1 Lambda responses (no `odsInstanceId` available) | `dbName` (string) |

Incoming ODS with `id !== null` are matched by `odsInstanceId`; those with `id === null` fall back to `dbName` matching. Both strategies run independently within the same delta computation.

**ODS Matching and Update Logic:**

• **`computeOdsListDeltas()` Method:**
  - **Matching Keys:** `odsInstanceId` (V2/non-SB V1 from form) or `dbName` (SB V1 Lambda)
  - **Change Detection:** Compares both `dbName` and `odsInstanceName` between existing and incoming ODS data
  - **Operations:**
    - **New:** Creates ODS instances not found in database
    - **Update:** Updates existing ODS when `odsInstanceName` or `dbName` changed
    - **Delete:** Removes ODS no longer present in API response
  - **Logging:** Comprehensive logging of all comparisons and detected changes

• **`persistSyncTenant()` Method:**
  - **Transaction Safety:** All updates wrapped in database transaction
  - **ODS Matching:** Uses dual-map strategy — `odsInstanceId` map for V2, `dbName` map for SB V1 Lambda
  - **Save Operations:**
    - Saves new ODS instances
    - Updates existing ODS instance names/dbNames
    - Processes education organizations for each ODS using `computeOdsTreeDeltas()`
  - **Error Handling:** Rolls back entire transaction on any failure

> **Note:** The delta logic is exercised in all sync paths — both the Admin API (`processTenantData()`) and the Starting Blocks Lambda path. No pre-deletion of existing rows occurs before `persistSyncTenant()` is called; only rows absent from the incoming data are removed.

### 6. Error Handling and Retry Logic

#### Error Types

• **Auth Failed (`AUTH_FAILED`):** Authentication or authorization issues
(401/403 errors)

• **Network Error (`NETWORK_ERROR`):** Connectivity issues like
unreachable endpoints

• **API Error (`API_ERROR`):** General API failures
including rate limiting (429) and server errors (5xx)

• **Data Transform Error (`DATA_TRANSFORM_ERROR`):** Issues processing API response data

#### Retry Logic

• **Maximum Attempts:** 3 retry attempts for eligible errors

• **Backoff Strategy:** Exponential backoff with delays of 2s, 4s, 8s between attempts

• **Retry Conditions:** Retries occur for network errors, authentication failures,
and server-side API errors (5xx)

• **Non-Retryable:** Client errors (4xx except
401/403) and data transformation errors are not retried

### 7. Tenant Management Strategy

#### Automatic Tenant Discovery

• **Read-Only Operations:** Admin API integration supports tenant reading via
`/tenants` endpoint but does not support tenant creation or deletion

• **Configuration-Based Management:** Tenant lists are maintained through Admin
API configuration files (appsettings) or environment variable overrides

• **Automatic Cache Updates:** When tenant configuration is updated in
appsettings or via environment variables, the Admin API tenant cache refreshes
automatically

• **Sync Integration:** Both manual "Sync SB" operations and scheduled sync jobs
automatically retrieve the latest tenant list from the refreshed cache

• **No Manual Reload Required:** The automatic cache refresh mechanism
eliminates the need for manual tenant list reloading operations. As a result,
the `Reload tenants` option will be hidden for `Non-StartingBlocks` environments

### 8. Consolidated list of Admin API endpoints

The following Admin API endpoints are utilized throughout this integration:

#### V1 Endpoints

• **ODS Instance Discovery (V1 Sync):**

- `GET /v1/odsInstances` — Retrieve ODS instances for the single-tenant environment
- **Usage:** Called by `AdminApiServiceV1.getTenants()` to discover ODS instances
- **Note:** Education organizations are **not** retrieved in V1 sync; `edOrgs` is always `[]`
- **Authentication:** Uses environment-level token (no tenant header)

#### Root Endpoint (Multi-Tenant Discovery)

• **Tenancy Information:**

- `GET /` - Root endpoint to retrieve tenancy mode and tenant list
- **Response Fields:**
  - `tenancy.multitenantMode` (boolean) - Indicates if multi-tenant mode enabled
  - `tenancy.tenants` (string[]) - Array of tenant names
- **Usage:** Initial tenant discovery in v2 environments
- **Authentication:** Requires environment-level token (no tenant header)

#### V2 Multi-Tenant Endpoints

• **Tenant Details:**

- `GET /v2/tenants/{tenantName}/OdsInstances/edOrgs` - Retrieve complete tenant data
- **Response:** ODS instances with nested education organizations
- **Headers Required:**
  - `Authorization: Bearer {tenant-specific-token}`
  - `tenant: {tenantName}`
- **Usage:** Primary data retrieval endpoint for tenant synchronization

#### V1 and V2 Common Endpoints

• **Education Organizations:**

- `GET /{version}/educationOrganizations` - Retrieve all education organizations
- `GET /{version}/educationOrganizations/{instanceId}` - Retrieve education
  organizations for specific ODS instance
- **Usage:** Core data retrieval for both V1 and V2 implementations
- **Authentication:** Requires tenant-specific token and tenant header for v2

• **ODS Instances:**

- `GET /{version}/OdsInstances` - Retrieve ODS instances for tenant
- **Usage:** Instance discovery and metadata retrieval
- **Authentication:** Requires tenant-specific token and tenant header for v2

#### Alternative Endpoints (Future Implementation)

• **ODS Instance Metadata:**

- `GET /{version}/OdsInstances/metadata` - Enhanced metadata retrieval
- **Status:** Planned replacement for education organizations endpoint
- **Purpose:** Enables more efficient data retrieval by using the metadata
  structure, which provides ODS instance details along with the list of
  education organizations

#### Credential Registration Endpoint

• **New OAuth Client Registration:**

- `POST /connect/register` - Register new Admin API client credentials
- **Usage:** Called by `createClientCredentials()` when provisioning credentials for newly discovered tenants
- **Request Headers:** `Content-Type: application/x-www-form-urlencoded`; `tenant: {tenantName}` (multi-tenant only)
- **Request Body (form-urlencoded):** `ClientId`, `ClientSecret`, `DisplayName`
- **Error Handling:** 400 response indicates the tenant does not exist or is not configured in Admin API

#### Endpoint Usage Patterns

• **Version Support:** All endpoints support both V1 and V2 API versions via `{version}` parameter

• **Authentication Requirements:**
  - **Environment-Level:** Root endpoint (`/`) uses environment-level token without tenant header
  - **Tenant-Specific:** All tenant operations require tenant-specific token using composite key pattern
  - **Tenant Header:** V2 multi-tenant endpoints require `tenant: {tenantName}` header
  - **Token Isolation:** Each tenant maintains its own OAuth token to prevent credential sharing

• **Error Handling:** 
  - Standard HTTP status codes with retry logic for 5xx errors and rate limiting (429)
  - 401 errors trigger re-authentication with tenant-specific credentials
  - Per-tenant error handling in parallel operations

## Implementation Status

### Completed Features

✅ **Credential Auto-Provisioning for New Tenants**
- Automatic detection of newly discovered tenants without credentials
- `POST /connect/register` integration to create OAuth client credentials
- Credentials stored in `configPublic` (key) and `configPrivate` (secret)
- Environment config reloaded post-provisioning before per-tenant sync

✅ **Orphaned Tenant Cleanup**
- Both V1 and V2 sync paths remove DB tenants no longer returned by the Admin API
- Cascade delete removes associated ODS instances and education organizations via FK CASCADE

✅ **Tenant-Specific Authentication**
- Composite token key pattern (`${environmentId}-${tenantName}`)
- Per-tenant OAuth token storage and retrieval
- Automatic login with tenant-specific credentials

✅ **Environment-Level Sync**
- Multi-tenant discovery via root endpoint
- Parallel tenant data fetching with per-tenant authentication
- Comprehensive error handling and logging

✅ **Tenant-Level Sync**
- Individual tenant synchronization support (v2 only)
- Proper authentication using `getAdminApiClient(tenant)`
- Tenant header inclusion in all API requests

✅ **Data Synchronization**
- ODS instance matching by stable `odsInstanceId`
- Change detection for ODS name updates
- Education organization relationship mapping
- Transaction-safe persistence operations

✅ **Post-Sync Cache Invalidation**
- Team ownership cache (backend `NodeCache`, 30 s TTL) is flushed immediately after a successful sync in both `syncEnvironmentData()` and `syncTenantData()`
- Frontend TanStack Query caches for ODS and EdOrg lists are invalidated on sync mutation success, so the UI reflects updated data without a page reload

✅ **User Interface Updates**
- Sync button visibility for v2 environments
- Sync queue display for both Starting Blocks and v2 environments
- Support for both environment and tenant-level sync actions

### Configuration Requirements

**Multi-Tenant Environment Configuration:**

```json
{
  "version": "v2",
  "tenants": {
    "tenant1": {
      "adminApiKey": "key_for_tenant1",
      "adminApiSecret": "secret_for_tenant1",
      "allowedEdorgs": [...]
    },
    "tenant2": {
      "adminApiKey": "key_for_tenant2",
      "adminApiSecret": "secret_for_tenant2",
      "allowedEdorgs": [...]
    }
  }
}
```

**Key Points:**
- Each tenant must have separate API credentials
- Credentials stored in environment configuration (public key, private secret)
- Tenant names must match those returned by Admin API root endpoint
