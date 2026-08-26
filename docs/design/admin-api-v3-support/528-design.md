# AC-528 Application Management V3 Frontend — Design

## Context

Give V3-specification tenants the same Application **list, create, view, edit,
and delete** experience V2 tenants already have. Per the ticket's acceptance
criteria, **Manage Credential (ApiClient) is explicitly out of scope** — that
remains a separate, already-isolated flow (`ApiClientV2`/`apiClients` route)
reachable only via the "Manage creds" action, which V2 already treats as a
distinct sub-resource from Application itself.

This ticket reuses the pattern established in [AC-527](./527-design.md)
(Vendor V3) — the `createVersionedResource`/`.match()` factory
(`packages/fe/src/app/api/queries/versioned.ts`) and the "rename `*V2` to
`*V2Plus`" approach — and the field-divergence handling worked out in
[AC-530](./530-design.md) (Claimset V3). This document only covers what's
specific to Application; for the mechanics of `createVersionedResource`,
`.match()`, why destructuring a versioned config directly into a write path
is unsafe, and the worked example of adding a version-specific field to a
shared react-hook-form component, see `527-design.md` sections 1 and 3a.
None of that is repeated here.

## Key findings

- `GetApplicationDtoV3` / `PostApplicationDtoV3` / `PutApplicationDtoV3` /
  `PostApplicationFormDtoV3` / `PutApplicationFormDtoV3` /
  `PostApplicationResponseDtoV3` already exist in
  `packages/models/src/dtos/edfi-admin-api.v3.dto.ts` (added as V3
  scaffolding under AC-524). They are structurally identical to their V2
  counterparts (`edfi-admin-api.v2.dto.ts`) **except** one rename: V2's
  `odsInstanceId` (form)/`odsInstanceIds` (get) becomes V3's `dataStoreId`/
  `dataStoreIds` — matching the Admin API V3 "dataStore" terminology already
  used elsewhere (`GetApiClientDtoV3.dataStoreIds`,
  `GetDataStoreSummaryDtoV3`).
- The backend already resolves this at the sync layer, not just in naming:
  `AdminApiSyncService` (`packages/api/src/sb-sync/edfi/adminapi-sync.service.ts`)
  maps both V2's `odsInstances` and V3's `dataStores` admin-API responses into
  the **same** `OdsInstanceDto` shape, which syncs into the **same** local
  `Ods` entity/table used today. This means the FE's local-ODS surface —
  `odsQueries`, `SelectOds`, `OdsLink`, and `useOdsTerminology.ts` (which
  already flips the displayed label between "ODS" and "Data Store" by
  `sbEnvironment.version`) — needs **no changes** for this ticket. Only the
  Application DTO's own field name differs between V2/V3; the underlying
  entity being referenced is identical.
- The Admin API V3 controller already exposes `GET dataStores`
  (`packages/api/src/teams/edfi-tenants/starting-blocks/v3/admin-api.v3.controller.ts:1080`),
  analogous to V2's `odsInstances` list endpoint that `odsInstancesV2`
  (`queries.v7.ts`) already calls. `GetDataStoreSummaryDtoV3` (used by that
  endpoint) already exists in the V3 DTO file.
- Integration Provider support does not exist for V3 at all: there is no V3
  controller route, backend service method, or FE query for it. This is not
  a gap to fill — `PostApplicationFormDtoV3`/`PutApplicationFormDtoV3`'s
  `integrationProviderId` field is optional and already unused in practice,
  matching V2's own form components, which have their Integration Provider
  `FormControl` **commented out** in both `CreateApplicationPage.tsx` and
  `EditApplication.tsx`. V3 carries the same dead field with zero new work.
- `useSingleApplicationActions` gates a "Manage creds" action that links to
  `.../applications/:id/apiClients` (the `ApiClientV2` surface). This is the
  action the ticket excludes for V3.
- `CreateApplicationPage.tsx` contains ODS-reconciliation logic specific to
  V2: it looks up the selected local `Ods` row, finds the matching Admin API
  ODS instance by name via `odsInstancesV2.getAll()`, and — if found — calls
  `odsQueries.put()` to backfill the local row's `odsInstanceId` with the
  Admin API's real ID before submitting the application with that ID. This
  exists because the local `Ods` row can be created before its Admin-API-side
  ID is known. The same staleness condition applies to V3 (same sync
  mechanism, same local `Ods` table), so the reconciliation carries over
  unchanged in shape, sourcing the Admin API side from a new `dataStoresV3`
  query instead of `odsInstancesV2`. **Flagged for a live spot-check during
  implementation** (matching the verification approach 530-design.md used for
  the Claimset copy endpoint) — confirm the V3 sync/reconciliation path
  behaves identically before assuming it does; this is not a blocking design
  question.

## Approach: rename `Pages/ApplicationV2` → `Pages/ApplicationV2Plus`

Same rationale as Vendor/Claimset: duplicating into a byte-for-byte-similar
`ApplicationV3` folder would just diverge on which query builder/DTO classes
are called. Extend the existing V2 surface to resolve queries and DTO classes
per-tenant at runtime instead.

### 1. API layer: add `applicationQueriesV3` and `dataStoresV3`

In `queries.v7.ts`:

```ts
export const applicationQueriesV3 = new EntityQueryBuilder({
  adminApi: true,
  name: 'Application',
  includeEdfiTenant: true,
  includeTeam: TeamOptions.Required,
})
  .getOne('getOne', { ResDto: GetApplicationDtoV3 })
  .getAll('getAll', { ResDto: GetApplicationDtoV3 })
  .post('post', {
    ResDto: PostApplicationResponseDtoV3,
    ReqDto: PostApplicationFormDtoV3,
    /* keysToInvalidate mirrors applicationQueriesV2 */
  })
  .put('put', { ReqDto: PutApplicationFormDtoV3 })
  .delete('delete')
  .build();

export const dataStoresV3 = new EntityQueryBuilder({
  adminApi: true,
  name: 'Datastore',
  includeEdfiTenant: true,
  includeTeam: TeamOptions.Required,
})
  .getAll('getAll', { ResDto: GetDataStoreSummaryDtoV3 })
  .build();
```

`dataStoresV3` is the V3 analog of the existing `odsInstancesV2` query — used
only for the create-time reconciliation lookup described above, not rendered
directly (rendering still goes through the shared local `Ods`
queries/components).

### 2. New file: `Pages/ApplicationV2Plus/applicationConfig.ts`

Same shape as `vendorConfig.ts`:

```ts
export type ApplicationEntity = GetApplicationDtoV2 | GetApplicationDtoV3;

export type ApplicationConfig =
  | {
      version: 'v2';
      queries: typeof applicationQueriesV2;
      PostFormDto: typeof PostApplicationFormDtoV2;
      PutFormDto: typeof PutApplicationFormDtoV2;
    }
  | {
      version: 'v3';
      queries: typeof applicationQueriesV3;
      PostFormDto: typeof PostApplicationFormDtoV3;
      PutFormDto: typeof PutApplicationFormDtoV3;
    };

export const useApplicationConfig = createVersionedResource<ApplicationConfig>({
  v2: {
    version: 'v2',
    queries: applicationQueriesV2,
    PostFormDto: PostApplicationFormDtoV2,
    PutFormDto: PutApplicationFormDtoV2,
  },
  v3: {
    version: 'v3',
    queries: applicationQueriesV3,
    PostFormDto: PostApplicationFormDtoV3,
    PutFormDto: PutApplicationFormDtoV3,
  },
});
```

### 3. Component changes

**Read-only pages that only pass `queries` through** (`ApplicationsPage.tsx`,
`ApplicationPage.tsx`'s title/breadcrumb, `NameCell.tsx`) swap their hardcoded
`applicationQueriesV2` import for `useApplicationConfig().queries`, and widen
DTO type annotations to `ApplicationEntity`. No `.match()` needed for these —
`applicationName`, `vendorId`, `claimSetName`, `profileIds`,
`educationOrganizationIds` are identical in name across V2/V3; only
`odsInstanceIds`/`dataStoreIds` differs, and these components don't touch
that field directly.

**`ViewApplication.tsx`** does read the diverging field (the "ODS"/"Data
Store" attribute and the ed-org cross-product). It dispatches via `.match()`:

```tsx
export const ViewApplicationV2Plus = (props: { application: ApplicationEntity & GetIntegrationAppDto }) =>
  useApplicationConfig.match({
    v2: () => <ViewApplication application={props.application as GetApplicationDtoV2 & GetIntegrationAppDto} dataStoreIds={(props.application as GetApplicationDtoV2).odsInstanceIds} />,
    v3: () => <ViewApplication application={props.application as GetApplicationDtoV3} dataStoreIds={(props.application as GetApplicationDtoV3).dataStoreIds} />,
  });
```

i.e. the shared `ViewApplication` body takes the resolved ID array as an
explicit prop rather than reading `application.odsInstanceIds` /
`application.dataStoreIds` itself — same shape as `530-design.md`'s
`ViewClaimset` wrapper. Everything else in `ViewApplication` (Vendor,
Profiles, Claimset, Integration Provider attribute — which stays empty for
V3 since the field is always unset) is unchanged.

**`CreateApplicationPage.tsx` and `EditApplication.tsx` are real write
paths**, so they follow Vendor's `.match()`-dispatched generic-form pattern
(527-design.md section 3, "Task 1 follow-up" in 3a):

```tsx
export const CreateApplicationPageV2Plus = () =>
  useApplicationConfig.match({
    v2: (cfg) => <CreateApplicationForm<PostApplicationFormDtoV2> config={cfg} dataStoreQuery={odsInstancesV2} odsFieldName="odsInstanceId" />,
    v3: (cfg) => <CreateApplicationForm<PostApplicationFormDtoV3> config={cfg} dataStoreQuery={dataStoresV3} odsFieldName="dataStoreId" />,
  });
```

The generic `CreateApplicationForm<D>`/`EditApplicationForm<D>` keep the
shared fields (`applicationName`, vendor, ed-org, profile, claimset) exactly
as today, using the `field`/`errorMessage` intersection-typed accessors from
527-design.md for those. The one diverging field
(`odsInstanceId`/`dataStoreId`) uses a scoped accessor the same way
527-design.md's worked example (section 3a) handles a v3-only field — except
here the field exists on **both** branches, just under different names, so
the scoped accessor takes the field name as a prop (`odsFieldName`) rather
than being hardcoded per-branch. The Admin-API-side reconciliation lookup
(`dataStoreQuery`, prop above) is likewise passed in per-branch instead of
hardcoded to `odsInstancesV2`, per the Key Findings note above — this is the
one piece of business logic (not just field naming) that forks by version.

`EditApplication.tsx`'s `hasIntegrationProvider` gating (disables
ODS/Ed-org/Integration Provider editing when the application came from an
Integration Provider) stays as today's logic — it will simply always be
`false` for V3 applications, since `integrationProviderId` is never set
there. No special-casing needed.

### 4. Action gating for out-of-scope Manage Credential (`useApplicationActions.tsx`)

`useSingleApplicationActions` switches from importing `applicationQueriesV2`
directly to `const { version, queries } = useApplicationConfig();` for the
shared `delete` mutation. The `Manage` action (single-entity "Manage creds")
stays gated behind an explicit `version === 'v2'` check, the same shape
530-design.md used to gate Claimset's V2-only Export/Import actions — a
deliberate, compiler-visible "V2-only capability" branch, not a silent
disappearance. `View`, `Edit`, `Delete`, and `useMultiApplicationActions`'s
`Create` stay common across both versions (subject to the same
privilege-based `useAuthorize` checks already in place, which are
version-agnostic).

### 5. Routing (`application.routes.tsx`)

Add a `v3` branch to the existing `VersioningHoc` for the applications-index,
application-detail, and create routes, pointing at the same version-aware
`ApplicationV2Plus` pages already used for `v2`:

```tsx
<VersioningHoc v1={<ApplicationPage />} v2={<ApplicationPageV2 />} v3={<ApplicationPageV2 />} />
```

`ApplicationBreadcrumbV2` (if present, mirroring `vendor.routes.tsx`'s
`useVendorBreadcrumbQueries`) gets a small `createVersionedResource` scoped
to its `getOne` query, covering both v2/v3, same as Vendor/Claimset.

### 6. Error handling

Unchanged from the established pattern: an unmapped/unsupported version
throws inside `useVersionedResource()`, caught by the existing page-level
`ErrorBoundary` already used for `ApplicationPageTitle`.

### 7. Testing

- Unit test `applicationConfig`'s v2/v3 branch selection (reusing the
  existing `createVersionedResource`/`.match()` test coverage from
  `versioned.spec.ts` — no new factory behavior to test, just a new config
  instantiation).
- Unit test the `CreateApplicationForm`/`EditApplicationForm` generic
  components against both DTO branches, confirming the correct
  `odsFieldName`/`dataStoreQuery` is used per version.
- Exercise existing ApplicationV2Plus test patterns (if any) against V3
  fixtures/DTOs to confirm identical CRUD behavior, including the
  create-time ODS/DataStore reconciliation path against a `dataStoresV3`
  fixture.
- Manual/E2E regression check against a running V3-enabled Admin API:
  create, view, edit, delete an application; confirm "Manage creds" is
  absent from the V3 application's action menu; confirm V1/V2 Application
  pages remain behavior-identical to before this change.

## Explicit scope boundaries

**In scope:** Application list, create, view, edit, delete for
V3-specification tenants, matching existing V2 UX/fields exactly except for
the `dataStoreId(s)` rename already present in the V3 DTOs.

**Out of scope:** Manage Credential / ApiClient management for V3
applications (separate, already-isolated flow — not touched by this ticket).
Integration Provider support for V3 (no backend support exists; V3 forms
carry the same unused field V2 already has commented out). Any change to V1
or V2 Application behavior (internal refactor only). Any other V3 entity.
