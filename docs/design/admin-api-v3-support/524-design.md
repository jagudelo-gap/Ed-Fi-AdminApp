# Admin API V3 Support — Design

Companion design doc to [README.md](./README.md) (AC-524). This covers the concrete
implementation design for adding a V3-aware surface to the Admin App API's
Starting Blocks integration.

## Verification against live specs

The live V2 and V3 swagger specs were diffed directly
(`https://localhost/odsv7-adminv2-multi-adminapi/swagger/v2/swagger.json` and
`.../odsv7-adminv3-multi-adminapi/swagger/v3/swagger.json`):

- Both specs expose exactly **44 paths** and **56 schemas** — a 1:1 structural match.
- Route rename confirmed: `odsInstances` → `dataStores`, `odsInstanceContexts` →
  `dataStoreContexts`, `odsInstanceDerivatives` → `dataStoreDerivatives`,
  `dbInstances` → `dbDataStores`, path param `{instanceId}` → `{dataStoreId}`.
- Schema rename confirmed 1:1 (e.g. `odsInstanceModel` → `dataStoreModel`,
  `addOdsInstanceRequest` → `addDataStoreRequest`, `dbInstanceModel` →
  `dbDataStoreModel`, etc.) — 13 schema renames total, no additions/removals.
- **Additional field-level renames found (not called out in task.md), confirmed in scope:**
  - `instanceType` → `dataStoreType` (on `dataStoreModel`, `dataStoreDetailModel`,
    `dataStoreWithEducationOrganizationsModel`, `addDataStoreRequest`, `editDataStoreRequest`)
  - `odsInstanceName` → `dataStoreName` (on `dbDataStoreModel`)
- The `adminApiError` schema is an opaque wrapper in both specs (no fields
  defined) — swagger does not reveal the RFC 7807 shape difference. The
  RFC 7807 error-shape assumption in task.md remains user-confirmed, not
  independently verifiable from swagger, and is treated as authoritative.

## Additional findings that change/narrow scope

- **Version detection for V3 environments already works today.** Task.md's
  concern about `AdminApiMeta`/`importantAdminApiVersions` (in
  `edfi-admin-api.dto.ts`) turned out to reference **dead code** — it has no
  callers anywhere in the codebase. The actual, currently-used detection path
  (`packages/api/src/utils/api-metadata-utils.ts` → `validateAdminApiUrl`, and
  `sb-environments-global/sb-environments-edfi.services.ts`) already reads
  `specificationVersion` directly off the Admin API's root response and
  already accepts `'v1' | 'v2' | 'v3'`. **No change needed here.** We will not
  touch `AdminApiMeta`/`importantAdminApiVersions` at all, eliminating the
  "shared file regression" risk task.md flagged.
- **`starting-blocks.v2.service.ts` and its `*-mgmt.v2.service.ts` helpers
  (`edorg-mgmt`, `ods-mgmt`, `tenant-mgmt`, `ods-rowcount`, `base-mgmt-service`)
  are AWS Lambda sync/job-queue orchestration** — confirmed out of scope
  (AC-526). These are **not** duplicated for V3.
- **`AdminApiServiceV2.selfRegisterAdminApi` is dead code** — not called from
  the V2 controller or any other production path. It is **not** ported to V3.
- **One real functional gap found:** `SbEnvironmentsGlobalService.updateAdminApi()`
  throws `CustomHttpException` for any `sbEnvironment.version` other than
  `'v1'`/`'v2'` when saving Admin API credentials for a tenant. Since
  `StartingBlocksServiceV2.saveAdminApiCredentials()` only touches the generic
  `{ tenants, adminApiSecret }` shape — which `ISbEnvironmentConfigPublicV3`
  already has, byte-for-byte — this method can be reused as-is for `v3`. We
  add a `v3` branch to `updateAdminApi()` that calls it directly (no
  duplication, no new class).

## Files to add

### `packages/models/src/dtos/edfi-admin-api.v3.dto.ts`

Duplicate of `edfi-admin-api.v2.dto.ts`. All class/type names get a `V3`
suffix instead of `V2` (e.g. `GetVendorDtoV3`, `PostApplicationDtoV3`). Field
and route-shape renames applied throughout:

| V2 | V3 |
|---|---|
| `odsInstanceId(s)` (fields) | `dataStoreId(s)` |
| `odsInstanceId` (path param) | `dataStoreId` |
| `instanceType` | `dataStoreType` |
| `odsInstanceName` | `dataStoreName` |
| `GetOdsInstanceSummaryDtoV2` | `GetDataStoreSummaryDtoV3` |
| `PostCreateOdsInstanceDtoV2` | `PostCreateDataStoreDtoV3` |
| `GetOdsInstanceDetailDtoV2` (+ `odsInstanceContexts`/`odsInstanceDerivatives` fields) | `GetDataStoreDetailDtoV3` (+ `dataStoreContexts`/`dataStoreDerivatives`) |
| `Post/Put/GetOdsInstanceContextDtoV2` | `Post/Put/GetDataStoreContextDtoV3` |
| `OdsInstanceDerivativeDtoBase`, `Get/Put/PostOdsInstanceDerivativeDtoV2` | `DataStoreDerivativeDtoBase`, `Get/Put/PostDataStoreDerivativeDtoV3` |
| `PutUpdateOdsInstanceDtoV2` | `PutUpdateDataStoreDtoV3` |
| `GetApplicationAssignedToOdsInstanceDtoV2` (+ `odsInstanceId` field) | `GetApplicationAssignedToDataStoreDtoV3` (+ `dataStoreId`) |
| `GetApiClientDtoV2.odsInstanceIds`, `PostApiClientDtoV2.odsInstanceIds`, etc. | `...DtoV3.dataStoreIds` |
| `GetApplicationDtoV2.odsInstanceIds` | `GetApplicationDtoV3.dataStoreIds` |

Everything with no naming/behavioral difference (vendors, profiles, actions,
claim sets, resource claims, auth strategies) still gets a duplicated `V3`
class — task.md's "reuse" carve-out applies to **service/controller logic**
(see below), not to DTOs, since DTOs are cheap to duplicate and the ticket
explicitly calls for a fully separate V3 DTO file consumed by the V3 module.

Imports from `edfi-admin-api.dto.ts` (`PostVendorDto`,
`PostApplicationDtoBase`, etc.) stay as-is — those base classes have no
ODS/data-store fields, so they're genuinely version-agnostic and already
shared by V2.

### `packages/api/src/teams/edfi-tenants/starting-blocks/v3/`

- **`admin-api.v3.controller.ts`** — duplicate of `admin-api.v2.controller.ts`.
  - Imports V3 DTOs from `@edanalytics/models` instead of V2.
  - Route param renamed `:odsInstanceId`/`:instanceId` → `:dataStoreId` where applicable.
  - `AdminApiV3Interceptor` (renamed copy of `AdminApiV2Interceptor`) checks
    `configPublic.version === 'v3'`.
  - `@UseFilters(new AdminApiV3ExceptionFilter())` instead of the V1x filter.
  - `@ApiTags('Admin API Resources - v3.x')`.
  - `selfRegisterAdminApi`-adjacent dead code is **not** carried over.
- **`admin-api.v3.service.ts`** — duplicate of `admin-api.v2.service.ts`,
  limited to methods actually reachable from the controller (i.e., excluding
  the unused `selfRegisterAdminApi`). Field/route renames applied per the
  table above. Still depends on `StartingBlocksServiceV2` for
  `saveAdminApiCredentials` (imported directly — this dependency is
  genuinely version-agnostic, per the finding above) rather than duplicating it.
- **`admin-api-v3-exception.filter.ts`** — new file, `AdminApiV3ExceptionFilter`.
  `@Catch(AxiosError)`, scoped only to `AdminApiControllerV3` via
  `@UseFilters`. Parses the Admin API V3 RFC 7807 problem-details shape:
  ```ts
  { type?: string; title: string; status: number; detail?: string; errors?: Record<string, string[]> }
  ```
  Maps this into the same `StatusResponse` shape the V1x filter produces
  (`title`, `type`, optional `message`/`data`), preserving the upstream
  `status` code (unlike the V1x filter, which always returns 500 for
  non-403/401/404 errors) so 400-class validation errors round-trip
  correctly to the frontend. 401/403 → 500 with an authorization-problem
  title (matching V1x behavior, since these still indicate an SBAA-side
  misconfiguration, not an end-user error). 404 → passthrough 404.
- **`admin-api.v3.module.ts`** — `AdminApiModuleV3`, controllers:
  `[AdminApiControllerV3]` (mirrors `AdminApiModuleV2`).
- **`index.ts`** — barrel file exporting the four files above (mirrors v2's
  barrel, minus the sync-service exports that don't apply).

### Registration

- `packages/api/src/app/routes.ts` — add
  `{ path: '/:teamId/edfi-tenants/:edfiTenantId/admin-api/v3', module: AdminApiModuleV3 }`
  as a sibling of the existing v1/v2 entries.
- `packages/api/src/app/app.module.ts` — add `AdminApiModuleV3` to the
  `imports` array alongside `AdminApiModuleV1`/`AdminApiModuleV2`.

### Credential-saving gap fix

- `packages/api/src/sb-environments-global/sb-environments-global.service.ts`
  — in `updateAdminApi()`, add:
  ```ts
  } else if (sbEnvironment.version === 'v3') {
    await this.startingBlocksServiceV2.saveAdminApiCredentials(edfiTenant, sbEnvironment, credentials);
  }
  ```
  before the `else` (unrecognized version) branch. No new service class.

## Testing plan

Mirrors V2 test depth 1:1:

- `admin-api.v3.controller.spec.ts` — same test cases as
  `admin-api.v2.controller.spec.ts`, adapted for `dataStoreId` params/DTOs.
- `admin-api.v3.service.spec.ts` — same test cases as
  `admin-api.v2.service.spec.ts`, adapted for renamed fields/routes.
- New tests for `admin-api-v3-exception.filter.ts` covering: a 400 RFC 7807
  body with `errors` map → surfaced correctly; a 401/403 → 500 with
  authorization-problem title; a 404 → passthrough; a non-JSON/unexpected
  body → generic fallback title.
- One added test case in `sb-environments-global.service.spec.ts` (or
  equivalent) for the new `v3` branch in `updateAdminApi()`.
- No changes to any existing V1/V2 spec files — this is purely additive.

## Out of scope (unchanged from task.md)

- Frontend/UI for V3 (AC-527–530).
- V3 sync/job-queue orchestration (AC-526) — no `starting-blocks.v3.service.ts`,
  no `*-mgmt.v3.service.ts` files.
- Docker/Compose/deployment changes (AC-523).
- New npm packages.
