# AC-530 Claimset Copy/Display V3 Frontend — Design

## Context

Give V3-specification tenants the same Claimset **list, view (including the
resource-claims tree), and copy** experience V2 tenants already have. Delete
also carries over. Per the ticket's acceptance criteria, **Create, Edit,
Import, and Export are explicitly out of scope** — Create/Edit aren't even
implemented for V2 today (`ClaimsetPage.tsx`'s edit branch renders `Not
implemented`; `useClaimsetActions.tsx`'s `Create` action is commented out),
and Import/Export are deferred to a follow-up ticket (AC-439 is referenced in
the ticket as the tracking issue for claimset UX improvements generally).

This ticket reuses the pattern established in [AC-527](./527-design.md)
(Vendor V3) and refined in [AC-568](./568-design.md) (Profile V3). **This
document only covers what's specific to Claimset** — for the mechanics of
`createVersionedResource`, `.match()`, why destructuring a versioned config
directly into a write path is unsafe, and the worked example of what to do
when V2/V3 fields actually diverge, see `527-design.md` sections 1 and 3a.
None of that is repeated here.

Claimset is the first entity in this series where **the V2/V3 DTOs actually
diverge in shape**, not just in name — 527-design.md section 3a anticipated
this ("this should generalize to Application/Claimset/Profile/ApiClient...
when they hit the same situation"). Profile and Vendor never hit it; this
design is that worked example.

## Key findings

Two live checks against a running V3-enabled Admin API established the
actual contract:

- `GET /v3/claimSets/{id}` and `GET /v3/claimSets` (list) both return
  **`claimSetName`** at the top level, not `name` — matches the Confluence
  design doc.
- `GET /v3/claimSets` (getAll) returns a **plain JSON array**, not an
  id-keyed object. This needs no special FE handling —
  `methods.getManyMap` (`packages/fe/src/app/api/methods.ts`) already
  assumes an array response and reduces it into a map itself; V2's endpoint
  presumably already returns an array too.
- `_applications` entries are minimal — `{ applicationName: string }` — not
  the full `GetApplicationDtoV3` shape. Confirmed live (an entry with a real
  application attached only ever has `applicationName`).
- Per-resource-claim entries verified live to have no `id` field at all
  (identified by `name`/`claimName` only), matching the Confluence doc's
  "Not present — identified by name" note.
- The plain `GET` endpoint already speaks the new CMS-flavored shape
  (`claimSetName`, `claimName`, `parentClaimName`, flat list) — this isn't
  limited to the import/export endpoints.
- **Verified live** (PR review follow-up): the `copy` endpoint's request-body
  field name for the new claim set's name. The assumption that it's still
  `name` (matching the V3 import example body and `CopyClaimsetDtoV3`'s
  unchanged shape) was spot-checked by exercising "Copy" on a claimset
  against a V3-enabled Admin API tenant — the new claimset was created
  successfully with the expected name and no validation error.
- `Pages/ClaimsetV2/CopyClaimset.tsx`'s `useClaimsetActions.tsx` already has
  `Create` commented out on both the single-entity and bulk action sets —
  confirming Create was never wired up for V2 either, consistent with the
  ticket scope.
- `ClaimsetLinkV2` (`packages/fe/src/app/routes/claimset.routes.tsx`) is also
  consumed by `Pages/ApplicationV2/ApplicationsPage.tsx` and
  `ViewApplication.tsx` to render a claimset relation link — those pages
  haven't been migrated to the versioned pattern themselves (a different,
  not-yet-scheduled ticket) and are out of scope here. `ClaimsetLinkV2`'s
  prop type still needs widening for this ticket's own V3 pages to use it,
  though — see Task 3 below.

## Verified V3 response shape (`GET /v3/claimSets/{id}`)

```json
{
  "id": 1,
  "claimSetName": "SIS Vendor",
  "_isSystemReserved": true,
  "_applications": [{ "applicationName": "Test Application" }],
  "resourceClaims": [
    {
      "name": "managedDescriptors",
      "claimName": "http://ed-fi.org/ods/identity/claims/domains/managedDescriptors",
      "parentClaimName": null,
      "actions": [{ "name": "Create", "enabled": true }, ...],
      "_defaultAuthorizationStrategies": [
        { "actionName": "Create", "authorizationStrategies": [{ "authStrategyName": "NamespaceBased" }] },
        ...
      ],
      "authorizationStrategyOverrides": []
    }
  ]
}
```

Compare to today's `GetClaimsetSingleDtoV2`/`edfi-admin-api.v3.dto.ts` (the
latter is currently a stale byte-for-byte copy of V2): `name` →
`claimSetName`; resource claims lose `id` and `children`, gain `claimName`
and `parentClaimName`; `authorizationStrategyOverridesForCRUD` →
`authorizationStrategyOverrides`;
`_defaultAuthorizationStrategiesForCRUD` → `_defaultAuthorizationStrategies`;
`actionId`/`authStrategyId`/`isInheritedFromParent` are gone from the action
and auth-strategy sub-objects.

## Approach: rename `Pages/ClaimsetV2` → `Pages/ClaimsetV2Plus`

Claimset has a real, separate V1 implementation (`Pages/Claimset`), same
situation as Vendor — so this is `git mv Pages/ClaimsetV2 Pages/ClaimsetV2Plus`
plus the edits below, v1 left untouched.

### 1. DTOs (`packages/models/src/dtos/edfi-admin-api.v3.dto.ts`)

Rewrite the Claimset-related V3 classes in place (they exist today but are
wrong — a stale V2 copy):

- `GetClaimsetMultipleDtoV3`: keep `id`, `_isSystemReserved`,
  `applicationsCount`/`displayName` getters as-is. Change `name` to read
  from the wire field `claimSetName` via `@Expose({ name: 'claimSetName' })`
  — this keeps the property named `name` on the class (so `displayName`,
  and any future consuming code, never forks on the rename; the rename is
  fully absorbed at the serialization boundary). `_applications:
  GetClaimsetApplicationDtoV3[]` — new minimal DTO, `{ @Expose()
  applicationName: string }` only, not the full `GetApplicationDtoV3`.
- `GetClaimsetSingleDtoV3 extends GetClaimsetMultipleDtoV3`: unchanged
  shape, `resourceClaims: GetResourceClaimDtoV3[]`.
- `ResourceClaimDtoV3` (base, also used by `ImportClaimsetSingleDtoV3` for a
  future ticket) / `GetResourceClaimDtoV3 extends ResourceClaimDtoV3`: drop
  `id` and `children`; add `claimName: string` and `parentClaimName: string
  | null`; rename `authorizationStrategyOverridesForCRUD` →
  `authorizationStrategyOverrides` (on the base class);
  `_defaultAuthorizationStrategiesForCRUD` → `_defaultAuthorizationStrategies`
  (on the `Get*` subclass, same split V2 already has).
- `ClaimsetActionAuthStrategyDtoV3`: drop `actionId`, keep `actionName` +
  `authorizationStrategies`.
- `ClaimsetAuthStrategyDtoV3`: drop `authStrategyId` and
  `isInheritedFromParent`, keep `authStrategyName`. None of the dropped
  fields are read by `ResourceClaimsTableV2`'s render logic today, so
  dropping their V3 equivalents is a type-only cleanup, not a behavior
  change.
- `CopyClaimsetDtoV3`: unchanged shape (`originalId`, `name`) — see the
  flagged assumption above.
- `PostClaimsetDtoV3`/`PutClaimsetDtoV3`/`PutClaimsetFormDtoV3`/
  `PutClaimsetResourceClaimActionsDtoV3`/
  `PostClaimsetResourceClaimActionsDtoV3`/`PostActionAuthStrategiesDtoV3`:
  untouched. Nothing in the FE calls these (Create/Edit/resource-claim
  editing aren't implemented for V2 either); leaving them as unverified V2
  copies is a pre-existing condition, not something this ticket introduces.
- `ImportClaimsetSingleDtoV3`: no changes needed beyond what `ResourceClaimDtoV3`
  already gets above — its own top-level `name` field is already correct as
  verified by the requester's real V3 import-body example. Not wired into
  any FE page this ticket (import stays deferred), but it's cheap
  correctness to leave in place for AC-439/the import follow-up ticket to
  build on rather than leaving it wrong twice.

### 2. API layer: add `claimsetQueriesV3`

In `queries.v7.ts`, add `claimsetQueriesV3` — deliberately **narrower** than
`claimsetQueriesV2`, matching only what this ticket's UI actually calls:

```ts
export const claimsetQueriesV3 = new EntityQueryBuilder({
  adminApi: true,
  name: 'Claimset',
  includeEdfiTenant: true,
  includeTeam: TeamOptions.Required,
})
  .getOne('getOne', { ResDto: GetClaimsetSingleDtoV3 })
  .getAll('getAll', { ResDto: GetClaimsetMultipleDtoV3 })
  .post(
    'copy',
    {
      ResDto: Id,
      ReqDto: CopyClaimsetDtoV3,
      keysToInvalidate: (params) => [
        params.standard,
        queryKeyNew({ kebabCaseName: 'claimset', edfiTenant: params.edfiTenant, id: false }),
      ],
    },
    (base) => standardPath({ edfiTenant: base.edfiTenant, teamId: base.teamId, kebabCaseName: 'claimset', adminApi: true, id: 'copy' })
  )
  .delete('delete')
  .build();
```

No `put`/`post`/`import`/`createExport` — there's no V3 UI path that would
call them, unlike Vendor/Profile V3 which mirror the full V2 surface because
Create/Edit are real features there.

### 3. New file: `Pages/ClaimsetV2Plus/claimsetConfig.ts`

Same shape as `vendorConfig.ts`/`profileConfig.ts`, but the config only
needs to carry what the copy form actually needs (there's no `Post`/`PutDto`
pair here — Create/Edit don't exist):

```ts
export type ClaimsetEntity = GetClaimsetMultipleDtoV2 | GetClaimsetMultipleDtoV3;

export type ClaimsetConfig =
  | { version: 'v2'; queries: typeof claimsetQueriesV2; CopyDto: typeof CopyClaimsetDtoV2 }
  | { version: 'v3'; queries: typeof claimsetQueriesV3; CopyDto: typeof CopyClaimsetDtoV3 };

// Do NOT annotate this const's return type — see 527-design.md's `.match`-erasure gotcha.
export const useClaimsetConfig = createVersionedResource<ClaimsetConfig>({
  v2: { version: 'v2', queries: claimsetQueriesV2, CopyDto: CopyClaimsetDtoV2 },
  v3: { version: 'v3', queries: claimsetQueriesV3, CopyDto: CopyClaimsetDtoV3 },
});
```

`queries.getOne`/`getAll`/`copy`/`delete` are common to both branches, so
reading them off the plain hook's union result type-checks safely (the
`keyof(A|B)` intersection covers all four). `claimsetQueriesV2`'s
`createExport`/`import`/`put`/`post` are **not** on this union — accessing
them requires importing `claimsetQueriesV2` directly (see Task 5), which is
the intended, compiler-enforced signal that those are V2-only capabilities.

### 4. Component changes — three different patterns, deliberately

**Read-only pages that only pass `queries` through (`ClaimsetsPage.tsx`,
`ClaimsetPage.tsx`'s title/breadcrumb, `NameCell.tsx`) use the plain hook.**
Swap the hardcoded `claimsetQueriesV2` import for `const { queries } =
useClaimsetConfig();`, and swap `GetClaimsetMultipleDtoV2`/
`GetClaimsetSingleDtoV2` type annotations for `ClaimsetEntity`/a
`GetClaimsetSingleDtoV2 | GetClaimsetSingleDtoV3` union respectively. No
`.match()` needed — these never instantiate a DTO, only read fields that are
identical in name after the `claimSetName` mapping is absorbed in the DTO
layer (Task 1).

**The resource-claims tree view genuinely diverges in shape, so it
dispatches via `.match()` like a write form does**, even though it's a read
path. `ViewClaimset.tsx` becomes a small generic wrapper taking the
resolved table component as a prop:

```tsx
function ViewClaimset<D extends GetClaimsetSingleDtoV2 | GetClaimsetSingleDtoV3>(props: {
  claimset: D;
  ResourceClaimsTable: React.ComponentType<{ claimset: D }>;
}) {
  const { claimset, ResourceClaimsTable } = props;
  return (
    <>
      <ContentSection>{/* _isSystemReserved / _applications.length attributes, unchanged */}</ContentSection>
      <ContentSection heading="Resource claims">
        <ResourceClaimsTable claimset={claimset} />
      </ContentSection>
    </>
  );
}
```

`ClaimsetPageContent` dispatches which concrete table/DTO pair to use:

```tsx
useClaimsetConfig.match({
  v2: () => <ViewClaimset claimset={claimsetV2Query.data} ResourceClaimsTable={ResourceClaimsTableV2} />,
  v3: () => <ViewClaimset claimset={claimsetV3Query.data} ResourceClaimsTable={ResourceClaimsTableV3} />,
})
```

**`CopyClaimset.tsx` is a real write path, so it uses `.match()`** the same
shape as `CreateProfilePage.tsx`: an outer component dispatches on the
resolved version into a shared generic form typed to the concrete branch,
using `config.CopyDto` for both the `classValidatorResolver` and
`defaultValues`.

### 5. Action gating for deferred Export/Import (`useClaimsetActions.tsx`)

`useClaimsetActions`/`useManyClaimsetActions` switch from importing
`claimsetQueriesV2` directly to `const { version, queries } =
useClaimsetConfig();` for the shared `copy`/`delete` mutations. The
`Export` action (single-entity) and `Import`/`Export` actions (bulk) stay
gated behind an explicit `version === 'v2'` check and continue to import
`claimsetQueriesV2` directly for `createExport` — this is a deliberate,
compiler-visible "V2-only capability" branch (mirroring 527-design.md
section 3a's shape for a V2/V3-diverging *field*, applied here to a
diverging *capability*), not a silent disappearance. The hardcoded
`admin-api/v2/claimsets/export/${id}` download link in the `Export` success
banner is left as-is — it's only ever reached from the V2-gated branch.

### 6. `ClaimsetLinkV2` (`routes/claimset.routes.tsx`)

Widen the `query` prop type from `Record<string | number,
GetClaimsetMultipleDtoV2>` to `Record<string | number, GetClaimsetMultipleDtoV2
| GetClaimsetMultipleDtoV3>`. Unlike `VendorLinkV2` (never widened, because
Vendor's V2/V3 DTOs are structurally identical so the existing type already
accepts either), Claimset's `_applications` field genuinely differs in shape
between V2/V3, so the V3 map isn't structurally assignable to the V2-only
type without this widening. No new component needed — `getRelationDisplayName`/
`getEntityFromQuery` only ever touch `id`/`displayName`.

### 7. Routing (`claimset.routes.tsx`)

`claimsetIndexRoute`, `claimsetsIndexRoute`, `claimsetCopyRoute`: add a `v3`
branch to the existing `VersioningHoc`, pointing at the same
version-aware `ClaimsetV2Plus` pages already used for `v2`.
`claimsetImportRoute` keeps only `v1`/`v2` — no `v3` branch, so
`VersioningHoc` renders `null` for V3 tenants that hit the import URL
directly, consistent with the deferred scope. `ClaimsetBreadcrumbV2` gets
deduped into a small `createVersionedResource` scoped to just its `getOne`
query (same shape as `vendor.routes.tsx`'s `useVendorBreadcrumbQueries`),
covering both v2/v3.

### 8. New component: `ResourceClaimsTableV3.tsx` (`packages/common-ui`)

A concrete sibling of `ResourceClaimsTableV2.tsx`, not a shared generic
(V2's isn't generic either). Same visual output (expandable tree,
`AuthStrategyBadge`, dynamically-derived action columns), different data
plumbing:

- Group `claimset.resourceClaims` into a `Map<string | null,
  GetResourceClaimDtoV3[]>` keyed by `parentClaimName`, built once with a
  single pass over the flat array.
- Root rows = entries whose own `parentClaimName` is `null`; each row's
  `subRows` are looked up from the map by that row's own `claimName`
  (replaces `rc.children`).
- `extractActions` recurses through the same map-based tree instead of
  `rc.children`.
- Field reads updated to the renamed `_defaultAuthorizationStrategies`/
  `authorizationStrategyOverrides`. `actionName`/`authStrategyName` reads
  are unchanged (the dropped `actionId`/`authStrategyId`/
  `isInheritedFromParent` were never read here).

### 9. `TeamNav.tsx`

No change needed — the Claimsets nav-visibility gate already reads
`privilege`-based authorization only, not a hardcoded version check (unlike
Profile's `sbEnvironment?.version === 'v2'`, which AC-568 had to widen).

## Explicit scope boundaries

**In scope:** Claimset list, view (including the resource-claims tree), and
copy for V3-specification tenants; delete carries over unchanged. DTO
corrections in `edfi-admin-api.v3.dto.ts` needed to support those flows.

**Out of scope:** Import, Export, Create, Edit for V3 (none of these are
implemented for V2 either, except Import/Export which are deferred by the
ticket). Any change to V2 Claimset behavior (internal refactor only). Fixing
`ApplicationV2`'s not-yet-versioned consumption of `ClaimsetLinkV2`/
`VendorLinkV2` (separate, not-yet-scheduled ticket). Verifying the `copy`
endpoint's exact request field name beyond the one flagged assumption —
worth a quick live spot-check during implementation, not a blocking design
question.

## Post-implementation note: `packages/api` was also in scope

`packages/api` — the Admin App's own Node backend, which proxies frontend
requests through to the real Ed-Fi Admin API — turned out to be in scope for
this ticket alongside `packages/fe`/`packages/models`/`packages/common-ui`.
Manual end-to-end verification against a running V3 environment found that
`AdminApiServiceV3.getClaimset`
(`packages/api/src/teams/edfi-tenants/starting-blocks/v3/admin-api.v3.service.ts`)
called the upstream Admin API's list endpoint with a query filter
(`GET claimSets?id=X`) instead of the true single-resource detail endpoint
(`GET claimSets/X`), so the claimset detail view received a list-shaped
array with no `resourceClaims` and crashed. `putClaimset`/`deleteClaimset`
in the same file, and `getVendor`/`getProfile` elsewhere in it, already used
the correct `entityName/${id}` pattern — `getClaimset` was the one method
that didn't. Fixed to match, with a new regression test
(`admin-api.v3.service.spec.ts`) asserting the exact single-resource call.

That same verification pass also surfaced a stale test fixture: an existing
`getClaimsets` (list) test in the same spec file still used the pre-rename
`name` field instead of `claimSetName`, left behind by this design's own
`GetClaimsetMultipleDtoV3` rename. Updated the fixture to match.
