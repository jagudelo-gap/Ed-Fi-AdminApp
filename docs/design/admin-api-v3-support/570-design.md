# AC-570 EdOrg V3 — Design

## Context

[AC-570](https://edfi.atlassian.net/browse/AC-570) asks that the Admin App can
see EdOrgs for V3-specification tenants. Its single stated acceptance
criterion is "the user is able to see EdOrgs," and its prerequisites assume
V3 sync (AC-526) is already in place.

Like ODS (AC-529, `529-design.md`), EdOrg turned out to be **not
version-split**. Testing against the current code shows the read path
already works for V3 with zero changes; the real gaps are two write paths
that are needlessly hardcoded to `version === 'v2'` even though nothing about
them is actually V2-specific.

## Key findings that shape this design

The Admin App's EdOrg surface has three independent paths, each with its own
story:

1. **List / View** — `EdorgsPage`, `EdorgPage`, `ViewEdorg` all read
   `edorgQueries`, a local BFF query backed by data the sync job already
   writes to Postgres (`GetEdorgDto`), not a direct Admin-API-version-specific
   call. No `VersioningHoc`, no nav gate on version. This already works for
   V3 today, mirroring ODS exactly.

2. **Manual "Sync Ed-Orgs" button** — a non-Starting-Blocks path
   (`useSyncEdOrgsAction.tsx` explicitly requires `!sbEnvironment.startingBlocks`)
   that calls the BFF's `sync-edorgs` endpoint, which calls
   `AdminApiServiceV2.getAllEdOrgsForTenant()` directly against the real
   Admin API. This is hardcoded to V2 end-to-end (FE gate, backend
   `@SbVersion('v2')` decorator, and the service's hardcoded
   `adminApiServiceV2` call) — but `AdminApiServiceV3.getAllEdOrgsForTenant()`
   ([admin-api.v3.service.ts:1087](../../../packages/api/src/teams/edfi-tenants/starting-blocks/v3/admin-api.v3.service.ts))
   **already exists**, already calls the correct V3 endpoint
   (`dataStores/edOrgs`, the V3 rename of `odsInstances/edOrgs`), and already
   returns the same `EducationOrganizationDto[]` shape V2 does. This is a
   real, small, additive gap — the backend half of the work is done, it's
   just unwired.

3. **Create / Delete EdOrg (Starting Blocks)** — gated behind
   `sbEnvironment.startingBlocks` (an AWS-managed-hosting flag, unrelated to
   Admin API version) in both `useEdorgsActions.tsx` (Create) and
   `useEdorgActions.tsx` (Delete). Confirmed during brainstorming: Create and
   Delete are **already invisible for ordinary V2 environments** (including
   local/self-hosted ones) because `startingBlocks` is false for them — this
   is a niche path that only matters for AWS Starting-Blocks-managed
   environments. Since Starting Blocks itself is frozen infrastructure that
   won't be updated to know about "V3," the correct fix is not to teach it
   about versions, but to stop the Admin App's *own* code from artificially
   refusing to route V3 environments through the same Lambda flow V2 already
   uses. Concretely: `BaseMgmtServiceV2.executeMgmtFunction()`
   ([base-mgmt-service.ts:34-35](../../../packages/api/src/teams/edfi-tenants/starting-blocks/v2/base-mgmt-service.ts))
   only reads the Lambda ARN out of `configPublic.values` when
   `configPublic.version === 'v2'` — for a V3 environment this silently
   returns `NO_CONFIG` and the request fails. The V3 config shape
   (`SbV3MetaEnv` in `starting-blocks.v3.dto.ts`) already declares the exact
   same ARN fields (`edorgManagementFunctionArn`, `tenantManagementFunctionArn`,
   `odsManagementFunctionArn`, `dataFreshnessFunctionArn`) as `SbV2MetaEnv` —
   this looks like V3 scaffolding from AC-524 that was never wired up.

**Side effect, intentionally accepted, not hidden:** `BaseMgmtServiceV2` is
shared by `TenantMgmtServiceV2` and `OdsMgmtServiceV2` too. Widening its
version check also fixes **ODS** Lambda-based create/delete for V3
Starting-Blocks environments as an incidental consequence — `odss.controller.ts`'s
`create()`/`remove()` carry no `@SbVersion` decorator, so they were only ever
blocked by `base-mgmt-service.ts`'s config check. **Tenant** create/delete are
not affected: `edfi-tenants.controller.ts:86,109` still carry their own
unwidened `@SbVersion('v2')` decorators, so those endpoints remain rejected
for v3 regardless of this change. This ticket does not add new test coverage
for ODS beyond confirming its existing V2 specs still pass unchanged —
re-verifying that flow belongs to whichever ticket actually exercises
Starting-Blocks V3 for ODS, not this one.

## Approach

### 1. List / View — verify only

No code change expected. First implementation task is a manual verification
pass against a live V3 environment (same process AC-529 used for ODS): confirm
the EdOrgs list and detail pages render correctly once sync has populated
data. Fix only what that surfaces.

### 2. Sync Ed-Orgs — wire up the existing V3 service call

- **`packages/api/src/teams/edfi-tenants/edorgs/edorgs.service.ts`**:
  `syncAllEdOrgs` currently takes `_sbEnvironment` (prefixed, unused) and
  hardcodes `this.adminApiServiceV2.getAllEdOrgsForTenant(edfiTenant)`. Use
  the parameter and branch:
  ```ts
  const allEdOrgs = sbEnvironment.version === 'v3'
    ? await this.adminApiServiceV3.getAllEdOrgsForTenant(edfiTenant)
    : await this.adminApiServiceV2.getAllEdOrgsForTenant(edfiTenant);
  ```
  Inject `AdminApiServiceV3` alongside the existing `AdminApiServiceV2`
  injection (consistent with how this service already injects V2 directly
  rather than going through `AdminApiVersionStrategyFactory` — `v1` never
  reaches this method because the controller decorator excludes it).
- **`packages/api/src/teams/edfi-tenants/edorgs/edorgs.controller.ts`**:
  widen `@SbVersion('v2')` on `syncEdOrgs()` to allow `v2`/`v3` (see decorator
  change below).
- **`packages/fe/src/app/Pages/Edorg/useSyncEdOrgsAction.tsx`**: widen
  `sbEnvironment?.version === 'v2'` to also allow `'v3'`. The
  `!sbEnvironment?.startingBlocks` condition is unchanged — this button stays
  scoped to non-Starting-Blocks tenants, as it is today.

### 3. Create / Delete — stop blocking Starting Blocks for V3

- **`packages/api/src/teams/edfi-tenants/starting-blocks/v2/base-mgmt-service.ts`**:
  widen the config-version guard in `executeMgmtFunction` from
  `configPublic.version === 'v2'` to `configPublic.version === 'v2' ||
  configPublic.version === 'v3'`. `SbV2MetaSaved`/`SbV3MetaSaved` share every
  field this method reads (`this.arnPropertyName` keys), so no further type
  changes are needed. No file rename — same rationale ODS's `instancesV2`
  builder used for staying "V2-named" despite being version-agnostic in
  practice.
- **`packages/api/src/teams/edfi-tenants/edorgs/edorgs.controller.ts`**:
  widen `@SbVersion('v2')` on `remove()` the same way. `create()` has no
  `@SbVersion` decorator today and needs none added — it was never
  version-restricted at the controller level, only blocked by the FE gate and
  by `base-mgmt-service.ts`.
- **`packages/fe/src/app/Pages/Edorg/useEdorgsActions.tsx`**: widen
  `sbEnvironment?.version === 'v2'` (the Create-button gate) to also allow
  `'v3'`. `useEdorgActions.tsx`'s Delete gate has no version check today — no
  change needed there.
- **`packages/fe/src/app/routes/edorg.routes.tsx`**: widen
  `edorgCreateRoute`'s `<VersioningHoc v2={<CreateEdorg />} />` to add
  `v3={<CreateEdorg />}`.
- **DTOs stay as-is.** Keep validating both versions against
  `AddEdorgDtoV2`/`RemoveEdorgDtoV2` — no dispatch to `AddEdorgDtoV3`/
  `RemoveEdorgDtoV3`. The Lambda payload contract doesn't change with Admin
  API version (Starting Blocks doesn't know what "V3" is), so introducing a
  second DTO class here would add complexity with no behavioral purpose. This
  deliberately does not follow the Vendor/Profile/Claimset
  `createVersionedResource` pattern — same reasoning as AC-529's ODS
  exception: there is no real per-version divergence to model.

### 4. Shared decorator: `@SbVersion` becomes multi-version

**`packages/api/src/auth/authorization/sbVersion.decorator.ts`**: change
`SbVersion(version: string)` to `SbVersion(...versions: string[])`, storing an
array via `SetMetadata`. **`packages/api/src/app/sb-environment-edfi-tenant.interceptor.ts`**:
update the guard from `sbVersion !== request.sbEnvironment.version` to
`!sbVersion.includes(request.sbEnvironment.version)` (guard against an empty/
undefined array short-circuiting the same way the current empty-string check
does). This is backward-compatible — the 7 other existing call sites
(`edfi-tenants-global`, `edfi-tenants`, `sb-environments-global`, `odss`,
`sb-environments`) keep calling `@SbVersion('v2')` unchanged; a single string
argument becomes a single-element array with no behavior change.

## Error handling

- An EdOrg Sync/Create/Delete request against a `v1` environment continues to
  be rejected by `@SbVersion('v2', 'v3')` with the existing
  `NotFoundException` ("... is not supported in v1 environments") — no change
  to v1 behavior.
- A Starting-Blocks-managed V3 environment whose `configPublic.values.meta`
  is missing the relevant ARN still gets the existing `NO_CONFIG` →
  "Bad system configuration" error path — unchanged, just now reachable for
  v3 configs that do have the ARN configured.

## Testing

- **`base-mgmt-service.spec.ts`** (new): `executeMgmtFunction` resolves the
  ARN for both `v2` and `v3` configPublic shapes; still returns `NO_CONFIG`
  for `v1`/undefined.
- **`sb-environment-edfi-tenant.interceptor.spec.ts`** (new, none exists
  today): a route decorated `@SbVersion('v2', 'v3')` allows both versions and
  rejects `v1`; a route decorated with the legacy single-arg form
  (`@SbVersion('v2')`) still restricts to exactly `v2`.
- **`edorgs.service.spec.ts`** (extend existing): `syncAllEdOrgs` calls
  `adminApiServiceV3.getAllEdOrgsForTenant` for a `v3` tenant and
  `adminApiServiceV2` for `v2`, unchanged.
- No changes to any existing V1/V2 spec — purely additive, matching the
  AC-527/529/530 precedent.
- **Manual/E2E** against a live V3 environment: List/View EdOrgs render
  correctly once synced; the Sync Ed-Orgs button succeeds for a non-Starting-
  Blocks V3 tenant; for a Starting-Blocks-managed environment (if available
  for testing), Create/Delete EdOrg behave identically between V2 and V3.

## Scope summary

**In scope:** EdOrg list/view verification for V3; Sync Ed-Orgs V3 wiring;
removing the artificial V2-only restriction on Starting-Blocks Create/Delete
EdOrg; the shared `@SbVersion` decorator generalization needed to do the
above without per-endpoint special-casing.

**Out of scope:** Any V1 behavior change; any new ODS test coverage (its
Lambda-mgmt V3 unlock is an accepted side effect, not a deliverable of this
ticket — Tenant create/delete are unaffected, still blocked for v3 by their
own unwidened `@SbVersion('v2')` decorators); any DTO-level V2/V3 divergence
for EdOrg (none exists); any
change to the automatic Starting-Blocks sync path (`dataFreshnessFunctionArn`,
`syncTenantResourceTree`) beyond what `base-mgmt-service.ts`'s widening
already unlocks incidentally.
