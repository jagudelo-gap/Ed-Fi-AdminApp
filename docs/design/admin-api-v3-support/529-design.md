# AC-529 ODS / Data Store V3 — Design

## Context

[AC-529](https://edfi.atlassian.net/browse/AC-529) asks to bring the ODS pages
to V3-specification tenants and to rename "ODS Instance" to "Data Store" in the
V3 UI. Testing against a live V3 tenant showed the ODS pages already work — so
the real question this design answers is *what is actually missing*, and the
answer is much smaller than the sibling entity migrations (Vendor AC-527,
Profile AC-568, Claimset AC-530).

## Key findings that shape this design

The ODS frontend is **not version-split**, unlike every other migrated entity.
There is a single `packages/fe/src/app/Pages/Ods/` folder and a single set of
routes (`packages/fe/src/app/routes/ods.routes.tsx`) with **no `VersioningHoc`**,
serving v1/v2/v3 identically. It gets away with this because:

- **List, View, and Breadcrumb** read `odsQueries` — the Admin App's own *local*
  BFF query, backed by the synced `GetOdsDto` (`packages/models/src/dtos/ods.dto.ts`),
  not the Admin API. This is version-agnostic by construction. The `instanceType`
  value shown in `ViewOds.tsx` and the `OdssTable` "Type" column is the *local*
  model's field, so the Admin API V3 rename `instanceType` → `dataStoreType`
  (documented in `524-design.md`) never reaches the UI.
- **Create and Delete** branch on `sbEnvironment.startingBlocks`, **not** on API
  version. The Starting Blocks path uses the version-agnostic local
  `odsQueries.post`/`odsQueries.delete`. The non-Starting-Blocks path uses the
  `instancesV2` query builder (`CreateOdsPage.tsx`, `OdssPage.tsx`), whose URL is
  built dynamically as `admin-api/${version}/…` — so it already targets the V3
  BFF route for a V3 tenant.

Consequences:

- The frontend has **zero** `version === 'v3' ? … : …` branches today, and this
  ticket adds essentially none.
- Because the folder is version-agnostic and also serves **v1** tenants, renaming
  it to `OdsV2Plus` would be misleading — it implies a version boundary that
  does not exist in the code. We deliberately **do not** rename the folder or
  adopt the `createVersionedResource` config pattern here. (If V3 ODS ever
  diverges hard, the right move at that point is the same `VersioningHoc` /
  `.match()` dispatch the other entities use, scoped to the one page that
  diverges — introduced when there is a real divergence to model, not
  pre-emptively.)

## The one real functional gap: BFF `dataStores/manage` endpoints

The non-Starting-Blocks Create/Delete path resolves to the BFF's V3 controller,
but that controller has **no** `postInstance`/`deleteInstance` — the string
`manage` appears nowhere in
`packages/api/src/teams/edfi-tenants/starting-blocks/v3/`. V2 has both:

- `admin-api.v2.controller.ts` — `@Post('instances')` `postInstance` (:1173) and
  `@Delete('instances/:instanceManageId')` `deleteInstance` (:1250).
- `admin-api.v2.service.ts` — `postInstance` → `POST odsInstances/manage` (:810)
  and `deleteInstance` → `DELETE odsInstances/manage/:id` (:828).

So a non-Starting-Blocks **V3** tenant's Create/Delete currently 404s. These
methods were in AC-524's stated scope but were deferred; AC-529 closes them.

The real Admin API V3 equivalents are confirmed in the Admin API source
(`AddDataStoreManage.cs` / `DeleteDataStoreManage.cs`): `POST dataStores/manage`
and `DELETE dataStores/manage/{id}`, with a request body
(`{ Name, DatabaseTemplate }`) byte-identical to V2's `odsInstances/manage`.

## Files to change

### Frontend — display-label rename (V3 only)

**New file `packages/fe/src/app/Pages/Ods/useOdsTerminology.ts`.** A hook that
reads `sbEnvironment.version` from `useTeamEdfiTenantNavContextLoaded()` and
returns a small label bundle:

```ts
export interface OdsTerminology {
  singular: string;      // "Data Store" | "ODS"
  plural: string;        // "Data Stores" | "ODS's"
  listTitle: string;     // "Data Stores" | "Operational Data Stores"
  createTitle: string;   // "Create new Data Store" | "Create new ODS"
}

export const useOdsTerminology = (): OdsTerminology => {
  const { sbEnvironment } = useTeamEdfiTenantNavContextLoaded();
  return sbEnvironment.version === 'v3'
    ? { singular: 'Data Store', plural: 'Data Stores', listTitle: 'Data Stores', createTitle: 'Create new Data Store' }
    : { singular: 'ODS', plural: "ODS's", listTitle: 'Operational Data Stores', createTitle: 'Create new ODS' };
};
```

Wire the hook into the string literals only (no data-flow changes):

- `OdssPage.tsx` — `PageTemplate` title (`listTitle`); row-action labels/titles
  and confirm body ("Delete ODS" / "This will permanently delete the ODS.");
  the `View` action title already interpolates `displayName`, no change needed.
- `OdsPage.tsx` — detail-title fallback (`'Ods'` → `singular`); the "ODS Row
  Counts" heading stays as-is (V2-only, Starting Blocks, see out of scope).
- `ViewOds.tsx` — no user-facing "ODS" literal to change; the "Type"/"Name"/etc.
  labels are generic. (Confirmed during implementation; included here so the
  reviewer knows it was considered, not missed.)
- `CreateOdsPage.tsx` — `PageTemplate` title (`createTitle`).
- `ods.routes.tsx` — breadcrumb strings (`'Create ODS'`, `"ODS's"`) and the
  `OdsLink` "Go to ods" / "Ods may have been deleted" alt text. Breadcrumb
  crumbs are plain functions, so each reads `useOdsTerminology()` via a tiny
  wrapper component (mirroring the existing `OdsBreadcrumb` pattern) rather than
  a bare string.

No route paths change; the URL segment stays `/odss/` (internal, not shown).

### Backend (BFF) — add the V3 manage endpoints

**`packages/models/src/dtos/edfi-admin-api.v3.dto.ts`** — add `PostInstanceDtoV3`,
a duplicate of `PostInstanceDtoV2` (`{ name, databaseTemplate }`, both
`@IsString()` + `@TrimWhitespace()`). Field names are unchanged from V2 (the
manage body is byte-identical), consistent with AC-524's "duplicate the DTO with
a V3 suffix" convention.

**`packages/api/src/teams/edfi-tenants/starting-blocks/v3/admin-api.v3.service.ts`**
— add `postInstance` and `deleteInstance`, copied from V2, changing only the
upstream Admin API URL:

- `postInstance`: `POST dataStores/manage` (was `odsInstances/manage`). Location-
  header id parsing unchanged.
- `deleteInstance`: `DELETE dataStores/manage/${instanceManageId}` (was
  `odsInstances/manage/${instanceManageId}`).

**`packages/api/src/teams/edfi-tenants/starting-blocks/v3/admin-api.v3.controller.ts`**
— add `postInstance` (`@Post('instances')`) and `deleteInstance`
(`@Delete('instances/:instanceManageId')`), copied from V2 verbatim. The local
`odsRepository.save(...)` bookkeeping, the `jobQueue.send(ENV_SYNC_CHNL, …)`
sync trigger, the `@Authorize` privileges, and the Admin-API validation-error
mapping are all version-agnostic and copy unchanged. Only the `@Body()` DTO type
switches to `PostInstanceDtoV3`.

The BFF route (`admin-api/v3/instances`) is exposed automatically by the existing
`AdminApiModuleV3` registration from AC-524 — no `routes.ts`/`app.module.ts`
change.

## What is explicitly NOT changing

- **No `OdsV2Plus` folder rename**, no `createVersionedResource` config, no
  `VersioningHoc` on the ODS routes (see findings above).
- **No new frontend query builder.** `instancesV2`'s dynamic-version URL already
  targets the V3 BFF route; once the BFF route exists (above), it works for V3
  with no FE query change. It keeps its `V2` name because it is version-agnostic
  in practice, and renaming it would ripple through the V2 pages for no benefit.
- **No change to the `GetOdsDto` / `PostOdsDto` local models** — they are BFF
  models, unaffected by the Admin API field renames.
- **ODS Row Counts** stays V2-only. The `OdsPage.tsx` Row Counts section is gated
  behind `sbEnvironment.startingBlocks` + a `VersioningHoc` with only a `v2`
  branch, and is backed by `startingBlocksServiceV2.odsRowCountService` (an AWS
  Lambda/management-layer dependency). A V3 path here is blocked on AC-526 and is
  out of scope.
- **No V1/V2 behavior change** of any kind — the terminology hook returns the
  existing "ODS" strings for every non-v3 version.

## Testing plan

- **Frontend:** a unit test for `useOdsTerminology` (returns Data Store labels
  for `version: 'v3'`, ODS labels for `v2`/`v1`/undefined). Existing ODS page
  tests, if any, continue to pass unchanged; add a render assertion that a v3
  context shows "Data Stores" and a v2 context shows "Operational Data Stores".
- **Backend:** mirror V2's coverage 1:1 for the two new methods —
  - `admin-api.v3.service.spec.ts`: `postInstance` calls `POST dataStores/manage`
    and parses the Location-header id; `deleteInstance` calls
    `DELETE dataStores/manage/:id`. Each new test would fail against the current
    (endpoint-less) V3 service.
  - `admin-api.v3.controller.spec.ts`: `postInstance` happy path + validation-
    error mapping; `deleteInstance` guard cases (`instanceManageId <= 0`,
    not-found, wrong-status) and the success path, matching
    `admin-api.v2.controller.spec.ts`.
- No changes to any existing V1/V2 spec — this is purely additive.

## Scope summary

**In scope:** "ODS" → "Data Store" display labels for V3-specification tenants;
BFF `dataStores/manage` create/delete endpoints for V3 (models + service +
controller + specs).

**Out of scope:** ODS Row Counts V3 (AC-526); any V1/V2 behavior change; any
folder rename or FE version-config refactor.
