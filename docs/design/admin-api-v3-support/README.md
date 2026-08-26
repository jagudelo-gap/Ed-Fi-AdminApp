# V3 specification integration guide

## Links

[PoC branch](https://github.com/Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp/tree/AC-508-PoC1) Use it as a guide. Not necessarily it will give you all the answers and it won't give you the full implementation. But it will give you a high level implementation requirements.

[Epic created on Jira.](https://edfi.atlassian.net/browse/AC-522)

## Backend Architecture (API)

### High-Level Structure

```
packages/api/src/
├── app/                          # App bootstrap & routes
├── auth/                          # Authentication & Authorization
├── database/                      # Database configuration
├── teams/                         # Team-scoped features (hierarchical)
│   ├── edfi-tenants/             # EdFi tenant management
│   │   ├── starting-blocks/      # Starting Blocks integration
│   │   │   ├── v1/               # ⭐ V1 SPECIFICATION SUPPORT
│   │   │   └── v2/               # ⭐ V2 SPECIFICATION SUPPORT
│   │   ├── odss/                 # ODS instances
│   │   ├── edorgs/               # Education organizations
│   │   └── ...
│   ├── ownerships/
│   ├── roles/
│   ├── users/
│   └── sb-environments/
│
├── *-global/                      # Global/cross-team features (non-hierarchical)
│   ├── edfi-tenants-global/
│   ├── odss-global/
│   ├── edorgs-global/
│   ├── ownerships-global/
│   ├── roles-global/
│   ├── users-global/
│   ├── integration-providers-global/
│   └── user-team-memberships-global/
│
└── sb-sync/                       # Starting Blocks synchronization
    ├── job-queue/                # Job queue configuration
    └── pg-boss.module/           # PostgreSQL-based queue
```

### V1, V2 & V3 Support: Starting Blocks Integration

[AC-524](https://edfi.atlassian.net/browse/AC-524) `Prepare the Admin App Api to support V3 specification`

The Admin App supports both **V1** (legacy) and **V2** (current) specifications for Ed-Fi deployments:

#### V1 (Legacy Specification)

- **Location**: `packages/api/src/teams/edfi-tenants/starting-blocks/v1/`
- **Services**: `AdminApiServiceV1`, `StartingBlocksServiceV1`
- **Characteristics**:
  - Single tenant per ODS deployment
  - Simpler metadata structure (`SbV1MetaOds`)
  - Uses first tenant from frontend data
  - Credential saving via `StartingBlocksServiceV1.saveAdminApiCredentials()`

#### V2 (Current Specification)

- **Location**: `packages/api/src/teams/edfi-tenants/starting-blocks/v2/`
- **Services**: `AdminApiServiceV2`, `StartingBlocksServiceV2`
- **Characteristics**:
  - Multi-tenant support
  - Enhanced metadata structure (`SbV2MetaEnv`, `SbV2MetaOds`)
  - Asynchronous sync via job queue
  - Tenant header support for multi-tenant environments

#### V3 (Initial Scaffolding)

- **Direction**: Establish V3 support by mirroring the existing V2 backend module structure as a dedicated V3 surface.
- **Scope**: Create a parallel Starting Blocks module area for V3 under the team tenant backend hierarchy.
- **Purpose**: Provide an isolated foundation for V3 evolution while keeping existing V2 behavior stable.

## V3 Synchronization Enablement

[AC-526](https://edfi.atlassian.net/browse/AC-526) `Admin App synchronizes environment created on a V3 specification`

- Extend the synchronization flow to recognize and process V3 environments as a first-class version.
- Evolve the sync orchestration boundaries so V3-specific processing can run within the existing job-driven model.
- Preserve cross-version stability by keeping V1/V2 synchronization behavior intact while introducing the V3 path.

---

## Frontend Architecture

### FE High-Level Structure

```
packages/fe/src/
├── main.tsx                      # Application entry point
├── app/
│   ├── api/                      # ⭐ V1 API INTEGRATION
│   │   ├── queries/
│   │   │   ├── queries.ts        # V1 query builders
│   │   │   ├── queries.v7.ts     # V7 specific queries
│   │   │   └── builder.ts        # Query building utilities
│   │   └── methods.ts
│   │
│   ├── api-v2/                   # ⭐ V2 API INTEGRATION
│   │   ├── useGetManyApplications.ts
│   │   ├── useGetOneIntegrationApp.ts
│   │   ├── useResetIntegrationAppCredentials.ts
│   │   └── ... (V2 hooks)
│   │
│   ├── Pages/                    # UI Pages & Features
│   │   ├── Home/
│   │   ├── EdfiTenant/
│   │   ├── SbEnvironment/ & SbEnvironmentGlobal/
│   │   ├── Ods/
│   │   ├── Edorg/ & EdorgGlobal/
│   │   ├── Team/
│   │   ├── User/ & UserGlobal/
│   │   │
│   │   ├── Application/          # V1 Application management
│   │   ├── ApplicationV2/        # ⭐ V2 Application management
│   │   │
│   │   ├── ApiClientV2/          # ⭐ V2-specific API Clients
│   │   ├── Claimset/             # V1 Claimset
│   │   ├── ClaimsetV2/           # ⭐ V2 Claimset
│   │   ├── Profile/
│   │   ├── ProfileV2/            # ⭐ V2 Profile
│   │   ├── Vendor/               # V1 Vendor
│   │   ├── VendorV2/             # ⭐ V2 Vendor
│   │   │
│   │   ├── Certification/
│   │   ├── CertificationV2/      # ⭐ V2 Certification
│   │   │
│   │   ├── IntegrationApp/       # V2 Integration Apps
│   │   ├── IntegrationProvider/  # Integration Providers
│   │   ├── Ownership/ & OwnershipGlobal/
│   │   ├── Role/ & RoleGlobal/
│   │   └── Account/
│   │
│   ├── Layout/                   # Shared layout components
│   ├── routes/                   # Route definitions
│   ├── helpers/                  # Utility functions
│   │
│   └── app.tsx                   # Main app component
│
├── config/                        # Application configuration
├── assets/                        # Static assets
└── main.tsx                       # Vite entry point
```

### V1, V2 & V3 Support: API Integration Strategy

#### V1 API Layer (`api/`)

- **Purpose**: Integration with Ed-Fi Admin API v1 and v7
- **Key Files**:
  - `queries/queries.ts`: V1 query definitions
  - `queries/queries.v7.ts`: V7-specific query builders
  - `queries/builder.ts`: Query URL builder utilities
- **Query Builders**:
  - `vendorQueriesV1`: Vendor management
  - `applicationQueriesV1`: Application management
  - `claimsetQueriesV1`: Claimset management
- **Usage**: Pages like `Application/`, `Vendor/`, `Claimset/` use V1 API

#### V2 API Layer (`api-v2/`)

- **Purpose**: Integration with newer Ed-Fi endpoints and integration management
- **Key Files**:
  - `useGetManyApplications.ts`: Fetch V2 applications
  - `useResetIntegrationAppCredentials.ts`: Credential management
  - `useGetManyIntegrationProviders.ts`: Provider listing
  - `apiClient.ts`: HTTP client configuration
- **Query Builders**:
  - `applicationQueriesV2`: V2 application endpoints
- **Usage**: Pages like `ApplicationV2/`, `ApiClientV2/`, `IntegrationApp/` use V2 API

#### V3 Frontend Implementation

- **Direction**: Begin V3 UI implementation as a parallel versioned frontend surface.
- **Scope**: Extend frontend routing, page structure, and API integration boundaries to include V3 flows.
- **Purpose**: Introduce V3 user experiences incrementally while preserving existing V1/V2 behavior.

[AC-527](https://edfi.atlassian.net/browse/AC-527)
[AC-528](https://edfi.atlassian.net/browse/AC-528)
[AC-529](https://edfi.atlassian.net/browse/AC-529)
[AC-530](https://edfi.atlassian.net/browse/AC-530)

### Version Routing in Frontend

#### Approach 1: The page changes from V2 with significant changes

```typescript
// Example from Pages structure
Application/       // → Uses V1 queries from api/
ApplicationV2/     // → Uses V2 hooks from api-v2/
ApplicationV3/     // → Uses V3 integration surface

Claimset/          // → Uses V1 queries
ClaimsetV2/        // → Uses V2 queries

Vendor/            // → Uses V1 queries
VendorV2/          // → Uses V2 queries
VendorV3/          // → Uses V3 queries
```

#### Approach 2: Minimal changes or not changes at all

In this case we can use V2 page for V3 as well, so we don't have to duplicate it. Using VendorsPage.tsx as an example.

```typescript
type VendorVersion = 'v2' | 'v3';

const getVendorQueriesByVersion = (version: VendorVersion) => {

  /// print version for debugging
  console.log('Vendor version:', version);
  
  if (version === 'v2') return vendorQueriesV2;
  return vendorQueriesV3;
};

type VendorsPageContentProps = {
  version?: VendorVersion;
};

export const VendorsPageContent = ({ version = 'v3' }: VendorsPageContentProps) => {
```

And on the routing:

```typescript
const VendorsPageByAdminApiVersion = () => {
  const { sbEnvironment } = useEdfiTenantNavContextLoaded();
  const adminApiVersion = sbEnvironment.version ?? 'v3';
  return <VendorsPageV2 version={adminApiVersion} />;
};
...
element: <VersioningHoc v1={<VendorsPage />} v2={<VendorsPageByAdminApiVersion />} v3={<VendorsPageByAdminApiVersion />} />,
```

---

## Config modules must bypass the `api` barrel (production-build circular-import trap)

The versioned entities (Vendor, Profile, Claimset, …) each have a
`Pages/<Entity>V2Plus/<entity>Config.ts` that builds a per-version config with
`createVersionedResource({ v2: { queries: <entity>QueriesV2, ... }, v3: { ... } })`.
That object literal **captures the query builders at module-init time**.

Those `<entity>QueriesV2/V3` builders live in `api/queries/queries.v7.ts`. A
config module **must import them directly from `../../api/queries/queries.v7`,
never from the `../../api` barrel.**

### Why

There is a pervasive circular dependency in the app:

```
api/index.ts (barrel)
  → api/queries/index.ts
      → export * from './queries'      (V1 queries.ts — runs BEFORE queries.v7)
          → helpers → routes barrel → <entity>.routes.tsx → page → <entity>Config.ts
      → export * from './queries.v7'   (V2/V3 builders defined HERE — runs later)
```

`api/queries/index.ts` re-exports the V1 `./queries` **before** `./queries.v7`.
If a config module is pulled into that cycle and reads the builders **through
the barrel** during this window, `queries.v7` has not executed yet, so the
builders are `undefined` — and the config literal captures `queries: undefined`
**permanently**. At render, `queries.getAll(...)` then throws
`TypeError: Cannot read properties of undefined (reading 'getAll')`, with **no
network request** (it fails before any query runs).

Importing directly from `queries.v7` forces that module to initialize before the
capture (its dependency tree — `builder → methods` — has no back-edge into the
routes cycle).

### Two conditions must both hold to trigger it — so keep either from being true

1. **The config reads builders via the barrel.** → Always import from
   `../../api/queries/queries.v7` directly. (Done for Vendor/Profile/Claimset.)
2. **Something pulls the config into the cycle at init.** For Claimset this was
   `claimset.routes.tsx` doing a runtime `import { useClaimsetConfig }` (for a
   breadcrumb). → In `*.routes.tsx`, use `import type { <Entity>Entity }` when you
   only need the config's **types** (as `profile.routes.tsx` does); reach for a
   runtime import of the hook only when a component defined in the routes file
   actually calls it.

### Notes

- **Dev and jest will NOT catch this.** The Vite dev server evaluates modules
  lazily/on-demand (config runs after `queries.v7`), and jest resolves modules
  via its own transform. The bug only appears in the **Rollup production bundle**
  (i.e. the Dockerized FE served by nginx). Verify fixes against a production
  build / the container, not just `nx serve` or unit tests.
- Diagnose circular imports with
  `npx madge --circular --extensions ts,tsx <entry-file>`.

---

## API Contracts: V1 vs V2 vs V3

### Data Transfer Objects (DTOs)

The backend defines separate DTOs by specification version:

#### V1 DTOs (Legacy)

```
ApplicationResponseV1
PostApplicationForm (V1)
GetApplicationDtoV1 (implied in queries)
```

#### V2 DTOs (Current)

```
GetApplicationDtoV2
PostApplicationFormDtoV2
PutApplicationFormDtoV2
ApplicationResponseV2
GetApiClientDtoV2
PostApiClientDtoV2
PutApiClientDtoV2
...
```

### V3 DTOs (Initial Scaffolding)

[AC-524](https://edfi.atlassian.net/browse/AC-524) `Prepare the Admin App Api to support V3 specification.`

V3 DTO support starts as a close parallel to the V2 DTO set, created as a dedicated V3 model surface.
At a high level, this establishes version-specific contracts for future V3 behavior without changing existing V2 contracts.

---

## Deployment & Environments

The Admin App can be deployed across multiple environment types:

### V3 Support Enablement

[AC-523](https://edfi.atlassian.net/browse/AC-523) `As a Admin App developer I have all the necessary containers running with Admin Api V3 specification`

Support for the V3 specification starts at the container orchestration layer.
At a high level, this includes expanding Compose definitions and environment settings so the local and shared runtime can host the additional V3-related services.

The initial scope for this enablement is centered on:

- `compose/edfi-services.yml`
- `compose/nginx-compose.yml`
- `compose/settings/` (supporting configuration files)

This infrastructure update establishes the deployment foundation required before deeper API, sync, and UI-level V3 feature work.
