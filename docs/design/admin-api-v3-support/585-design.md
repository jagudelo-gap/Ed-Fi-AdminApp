# AC-585 Claimset Import/Export V3 — Design

## Context

[AC-585](https://edfi.atlassian.net/browse/AC-585) adds Claimset **import** and
**export** support for V3-specification tenants. Both were explicitly deferred
by [AC-530](./530-design.md) (Claimsets V3), which shipped list, view, and copy
only — Import/Export were left gated behind `version === 'v2'`.

Reference: [Claim Set Export/Import API Design](https://edfi.atlassian.net/wiki/spaces/BD/pages/2453733392/Claim+Set+Export+Import+API+Design#Payload-Differences-(v2-vs-v3))
(Confluence). The findings below were verified **live** against the local Docker
stack rather than taken from the doc — both `odsv7-adminv2-multi-adminapi`
(`specificationVersion: v2`) and `odsv7-adminv3-multi-adminapi`
(`specificationVersion: v3`), tenant `tenant1`.

## Verified payload differences (V2 vs V3)

Measured on claimset `6` ("Bootstrap Descriptors and EdOrgs"), which has real
nesting. **V2: 8 top-level resource claims, 25 total including nested. V3: 25
top-level, 0 nested.** The total claim count is identical — V3 flattens the
tree and expresses the hierarchy through `parentClaimName` instead of `children`.

Envelope: both versions' import request bodies are `{ name, resourceClaims }`.
Only the **resource-claim item shape** differs.

| | V2 | V3 |
|---|---|---|
| claimset name (export) | `name` | `claimSetName` |
| hierarchy | nested `children[]` | flat list joined by `parentClaimName` |
| claim identity | `id` (numeric) | `claimName` (full URI); no `id` |
| default auth strategies | `_defaultAuthorizationStrategiesForCRUD` | `_defaultAuthorizationStrategies` |
| auth strategy overrides | `authorizationStrategyOverridesForCRUD` | `authorizationStrategyOverrides` |
| nested strategy fields | `actionId`, `authStrategyId`, `isInheritedFromParent` | dropped |

`claimName` is **not derivable** from the short `name` (e.g. `types` →
`http://ed-fi.org/ods/identity/claims/domains/edFiTypes`; domain-level claims
carry a `/domains/` segment, leaf claims do not).

**Round-trip verified working:** a V3 export fed back into V3's import
reproduced the source exactly — 25/25 claims, 8 roots + 17 children, identical
claim-name set.

## Approach

The work is **frontend-only** in the sense that no `packages/api` source file
changes. Four narrow gaps, plus one latent bug. However, the new DTO decorators
described in section 2 are not purely client-side: `packages/api/src/main.ts`
installs a global `ValidationPipe`, and `ImportClaimsetSingleDtoV2/V3` and
`CopyClaimsetDtoV2/V3` are the `@Body()` DTO types on the BFF's import/copy
controller routes. So the shared DTO decorators are also enforced **server-side
at the BFF**, not only in the browser — this is defense-in-depth and is worth
keeping, but it means "frontend-only" should be read narrowly (no backend
*source* changes) rather than as "the validation only runs in the browser."

### 1. Backend (`packages/api`) — no source changes

Confirmed already complete, inherited from AC-524's V3 module duplication:

- `AdminApiControllerV3` already exposes `@Post('claimsets/export')`,
  `@Get('claimsets/export/:exportId')`, and `@Post('claimsets/import')`.
- `AdminApiServiceV3.exportClaimset` already deserializes via
  `toGetClaimsetSingleDtoV3` (the flat V3 shape); `importClaimset` already
  POSTs to `claimSets/import`.
- `AdminApiV3ExceptionFilter` already maps the V3 RFC 7807 problem-details
  `errors` map into `StatusResponse.data`, so Admin API field-level validation
  messages reach the import page's existing error popover unchanged. Verified
  against a live 400: the V3 response carries both `validationErrors` and
  `errors` keys with identical content, and the filter reads `errors`.

The exported document the controller builds is
`{ title, template: { claimSets: [{ name, resourceClaims }] } }` — note it emits
`name` (already mapped from `claimSetName` by the DTO), so the file envelope is
version-independent and the import page's existing `content.template.claimSets`
parsing needs no change.

### 2. Models (`packages/models`) — no *shape* changes

`ImportClaimsetSingleDtoV3 { name, resourceClaims: ResourceClaimDtoV3[] }` and
the flat `ResourceClaimDtoV3` already exist from AC-530 and match the wire
shape. No DTO shape, field, or serializer changes are required.

(Validation *decorators* are added to the Copy/Import name fields — see
section 6. That is the only change in this package.)

A V3 export file also contains `_defaultAuthorizationStrategies` (present on
`GetResourceClaimDtoV3` but not on the narrower `ResourceClaimDtoV3`). The
import page calls `plainToInstance` without `excludeExtraneousValues`, so the
field passes through to the Admin API — verified accepted (HTTP 201). This
mirrors existing V2 behavior, which likewise passes
`_defaultAuthorizationStrategiesForCRUD` through.

### 3. FE API layer: add two members to `claimsetQueriesV3`

In `packages/fe/src/app/api/queries/queries.v7.ts`, `claimsetQueriesV3`
currently has only `getOne`/`getAll`/`copy`/`delete`. Add, mirroring the
existing `claimsetQueriesV2` definitions:

- **`createExport`** — `.post('createExport', { ResDto: Id, ReqDto: class Nothing {} }, …)`
  with the path override `id: \`export?id=${pathParams.ids.join('&id=')}\``.
- **`import`** — `.post('import', { ResDto: Id, ReqDto: ImportClaimsetSingleDtoV3, keysToInvalidate: … }, …)`
  with the path override `id: 'import'`.

`EntityQueryBuilder` already builds the URL as
`admin-api/${edfiTenant.sbEnvironment.version}/…`, so both automatically target
the V3 BFF routes for a V3 tenant — no path plumbing needed.

### 4. FE actions hooks: remove the V2-only gates, fix the download URL

In `Pages/ClaimsetV2Plus/useClaimsetActions.tsx`, both `useClaimsetActions` and
`useManyClaimsetActions` currently do:

```ts
const createExport =
  version === 'v2' ? claimsetQueriesV2.createExport({ edfiTenant, teamId: asId }) : undefined;
```

Once `claimsetQueriesV3.createExport` exists, `createExport` is a member of
**both** union branches, so it comes from `useClaimsetConfig().queries` like
`delete`/`copy` already do. The direct `claimsetQueriesV2` import is dropped
(the file keeps importing `API_URL`). The `version === 'v2'` gate on the bulk
**Import** button is likewise removed.

**Latent bug fixed here:** the export download link is currently hardcoded to
the V2 route in both hooks —

```ts
to={`${API_URL}/teams/${teamId}/edfi-tenants/${edfiTenant.id}/admin-api/v2/claimsets/export/${data.id}`}
```

It must interpolate the tenant's version (`admin-api/${version}/…`), using the
`version` already returned by `useClaimsetConfig()`. Without this, a V3 tenant's
export would download through the V2 BFF route.

### 5. FE page + routing: a dedicated V3 import page

Add `Pages/ClaimsetV2Plus/ImportClaimsetsPageV3.tsx`, a copy of the existing V2
import page with `ImportClaimsetSingleDtoV3` and `claimsetQueriesV3.import`
substituted.

**Why a separate file rather than one version-aware page:** the import page is
already version-split in this codebase — `Pages/Claimset/ImportClaimsetsPage.tsx`
(V1) and `Pages/ClaimsetV2Plus/ImportClaimsetsPage.tsx` (V2) are separate
duplicated files today. A V3 sibling follows that established precedent. The
file stays in `ClaimsetV2Plus/` because all other claimset pages live there.

To be explicit about the trade-off, since the rationale is a judgement call and
not a technical constraint: **there are no V3-incompatible blocks in this page.**
The measured V1→V2 delta is 19 insertions / 15 deletions across ~256 lines, all
mechanical identifier swaps; a V2→V3 delta is smaller still — two identifiers
(`ImportClaimsetSingleDtoV2` and `claimsetQueriesV2.import`) across 8 sites,
plus the exported component name. The page is immune to the flat-vs-nested
change because it never inspects the claim tree: it reads only `claimset.name`
(present on both DTOs) and passes `resourceClaims` through as an opaque payload,
so the entire structural difference is invisible to it. `lowercaseFirstLetterOfKeys`
likewise recurses generically and needs no change.

The choice is therefore ~250 duplicated lines versus ~2 identifiers of type
indirection. Duplication was chosen deliberately for consistency with the
existing V1/V2 split, to avoid a generic-component + `.match()` dispatch for
variance this small, and to leave headroom for genuinely V3-specific UI later
(e.g. a `parentClaimName`-based hierarchy preview). A future reader should not
"fix" this back into a shared page without revisiting that trade-off.

Version-agnostic logic carried over unchanged: `lowercaseFirstLetterOfKeys`
(verified safe for V3's `claimName`, `parentClaimName`, and the
underscore-prefixed `_defaultAuthorizationStrategies`), the
`content.template.claimSets` file parsing, the per-claimset validate/import
loop, and the error popover.

Routing — `claimsetImportRoute` in `routes/claimset.routes.tsx` currently reads:

```tsx
element: <VersioningHoc v1={<ImportClaimsetsPage />} v2={<ImportClaimsetsPageV2 />} />,
```

It gains a `v3={<ImportClaimsetsPageV3 />}` branch. Today a V3 tenant
navigating to `/claimsets/import` renders nothing, because `VersioningHoc`
returns `null` for an unmapped version.

### 6. Client-side name validation (fail before the API round-trip)

The Admin API's name rules were characterized empirically (probing
`POST /claimSets` on both versions, deleting every claimset created):

| name | V2 | V3 |
|---|---|---|
| `NoSpacesAtAll` | 201 | 201 |
| single inner space | 201 | **400** whitespace |
| multiple inner spaces | 201 | **400** whitespace |
| leading/trailing whitespace only | 201 | **400** whitespace |
| inner **tab** | 201 | **400** whitespace |
| `Dash-Under_Dot.Ok` | 201 | 201 |
| 300 characters | **400** (<255) | **400** (<255) |

So V3 rejects **any** whitespace character anywhere (not just spaces), while the
255-character limit applies to **both** versions. Neither rule is declared in
swagger (`name` is a bare `{"type":"string"}` in both) — they are enforced in
Admin API code only, which is why they must be mirrored deliberately here.

Implementation — decorators on the **V3 DTOs only** for whitespace, and both
versions for length. `@Matches` is already the established pattern in this
codebase (`edfi-tenant.dto.ts`, `ods.dto.ts`, `sb-environment.dto.ts`):

- `CopyClaimsetDtoV3.name` and `ImportClaimsetSingleDtoV3.name` gain
  `@IsNotEmpty()` and
  `@Matches(/^\S*$/, { message: 'Name must not contain white spaces.' })`,
  wording mirroring the Admin API's own message. (The regex is `*`, not `+` —
  `+` would report the whitespace message for an empty name too; `@IsNotEmpty()`
  gives empty its own, correct message.)
- `CopyClaimsetDtoV2/V3.name` and `ImportClaimsetSingleDtoV2/V3.name` gain
  `@MaxLength(254)`.

`@TrimWhitespace()` already strips leading/trailing whitespace before validation
runs, so the `^\S*$` rule effectively targets inner whitespace — matching what
the server sees once we trim.

**These decorators are not client-side only.** `packages/api/src/main.ts`
installs a global `ValidationPipe`, and these DTOs are the `@Body()` types on
the BFF's import/copy controller routes (V2 and V3 alike), so the same rules
are re-enforced server-side at the BFF before the request ever reaches Admin
API. `@MaxLength` returns `false` (fails validation) rather than throwing for a
non-string value, so a malformed `name` cannot produce an unhandled rejection
in the pipe.

**No component changes are needed for Copy.** `CopyClaimsetFormInner` already
builds its resolver from the config branch's `CopyDto`
(`classValidatorResolver(CopyDto)`), so a validator on `CopyClaimsetDtoV3`
produces inline field-level errors for V3 tenants automatically, and V2 is
untouched.

**Copy's default name is deliberately left as `"<name> (copy)"`** for both
versions, even though it is guaranteed to violate V3's rule when the source name
contains spaces. Rationale: the Admin App should not impose a naming convention
(PascalCase vs. hyphen vs. underscore is a deployment-level style choice), and
silently stripping the user's whitespace is worse than telling them the rule.
The inline error fires on submit with no API round-trip, which satisfies the
fail-early goal. Consequence to accept: for V3, the Copy form opens pre-filled
with a value the user must edit before saving.

**V3-only helper text on the Copy form.** Because that pre-filled default is
known-invalid and react-hook-form validates on submit by default, the rule is
stated up front rather than only after a failed Save. Add a Chakra
`<FormHelperText>` beneath the Name input — rendered **only for V3** — with
concise wording such as `Cannot contain whitespace.` This states the constraint
without prescribing a replacement style, which is the point of leaving the
default alone.

This requires `version` in `CopyClaimsetFormInner`'s `config` prop type
(currently declared as `{ queries; CopyDto }`). The object `useClaimsetConfig`
already carries `version`, and `.match()` already passes the whole branch
config, so only the declared prop type widens — no call-site change. Branching
on `props.config.version === 'v3'` in JSX follows the precedent set in
[527-design.md](./527-design.md) section 3a for version-divergent form fields.

No helper text is added to the import page: there the name comes from the
uploaded file rather than user input, so the per-entry validation error is the
appropriate guidance.

**One latent bug must be fixed in the V3 import page**, or this validation is
invisible. The existing V2 page does:

```ts
validate(claimset).then((errors) => {
  if (errors.length > 0) { setError({ title: 'Claimset validation failed', … }); }
  setClaimset(claimset);
  setError(undefined);   // ← unconditionally clears the error just set
});
```

`setError(undefined)` always overwrites the error. The V2 import DTO now
carries `@MaxLength(254)` (added by this ticket), so the bug is no longer
merely latent — but the V2 page's unconditional `setError(undefined)` means
that validator is **deliberately inert**: a V2 user importing a 300-character
name gets no client-side message (the server still 400s, so this is not a
regression, just an intentionally unchanged rough edge). Fixing the V2 page
so its length validator surfaces is left as a follow-up, worth its own
ticket — it is out of this ticket's scope.

The V3 page fixes the bug outright, which is why V3's validators (both the
whitespace rule and the 254-char limit) actually surface to the user. The V3
page must (a) only clear the error when validation passes, and (b) disable
the per-claimset **Import** button while that entry is invalid — otherwise a
user can still submit a known-bad name.

## Testing plan

- **`claimsetQueriesV3` wiring:** unit test asserting the new `createExport` and
  `import` members build the expected `admin-api/v3/…/claimsets/export?id=…`
  and `…/claimsets/import` paths with the V3 request DTO — a mis-wired builder
  (e.g. reusing a V2 DTO) would otherwise typecheck and pass everything else.
- **Actions hooks:** a spec asserting Export (single + bulk) and Import are
  exposed for **both** `v2` and `v3` config branches — the current specs only
  ever exercise the V2 branch — and that the download URL interpolates the
  tenant's version rather than a hardcoded `v2`.
- **V3 import page:** a spec mirroring the existing page specs — file parsing
  produces the claimset list, and clicking Import calls
  `claimsetQueriesV3.import` with the parsed entity.
- **Name validation:** DTO-level specs asserting `CopyClaimsetDtoV3` and
  `ImportClaimsetSingleDtoV3` reject a name with an inner space **and** one with
  an inner tab, accept `Dash-Under_Dot.Ok`, and reject a 300-character name;
  plus specs asserting the V2 counterparts still **accept** whitespace (guarding
  against the rule leaking into V2) while rejecting 300 characters.
- **Import page error surfacing:** a spec that a claimset entry with an invalid
  name keeps its validation error displayed (the `setError(undefined)` bug
  regression) and leaves its Import button disabled. This test fails against the
  current V2 page logic, which is the point.
- **Copy helper text:** a spec asserting the "Cannot contain whitespace." helper
  text renders for the `v3` config branch and is absent for `v2`.
- **No changes to existing V1/V2 specs.** This work is additive; the only edits
  to shared V2 code are removing the version gates and fixing the download URL,
  both of which must leave the V2 UI behavior and the V2 happy path unchanged.
  (The V2 import DTO's new `@MaxLength(254)` is now also enforced by the BFF's
  global `ValidationPipe` — a V2 import with a missing/non-string or 255+ char
  `name` is rejected by the BFF instead of being proxied to Admin API. Same
  user-visible outcome, a different error shape, so this is narrower than
  "V2 behavior identical.")
- **Manual verification** against the live V3 tenant: export a claimset →
  download the file → re-import it → confirm the resulting claimset matches the
  source (claim count, roots vs. children). Then the same on a V2 tenant to
  confirm no regression.

## Known limitations (accepted, not addressed by this ticket)

Both were discovered during live investigation and are **Admin API behavior**,
not Admin App defects. They are recorded here so they are not re-diagnosed
later.

1. **Export files are version-specific.** Feeding a V2-shaped (nested) file to
   V3's import endpoint returns **HTTP 201 success** but silently drops every
   nested child claim — 25 claims became 8 (roots only), with no error or
   warning, because V3 ignores the unknown `children` property. A deliberate
   decision was made not to add a client-side shape guard for this ticket;
   files are treated as version-specific.

   Automatic V2 → V3 conversion is **not feasible** from the file alone: flat
   V3 children require a canonical `parentClaimName` URI, a V2 export contains
   no URIs, and `GET /v3/resourceClaims` does not expose `claimName` either (it
   returns only short names and `parentId`/`parentName`). Verified: short names
   resolve for *root* claims but are rejected for parents —
   `"Child resource: 'communityOrganization' added to the wrong parent resource."`

2. **V3's own seed data violates V3's whitespace rule.** System-reserved V3
   claimsets ship with spaces in their names ("AB Connect", "Bootstrap
   Descriptors and EdOrgs"), yet V3's API rejects creating those same names. The
   practical consequence: **no system-reserved V3 claimset can be copied or
   re-imported without the user renaming it.**

   This is not fixable from the Admin App. Verified: the Admin App seeds no
   claimsets anywhere — the only `claimset` strings in our migrations are
   authorization *privileges* (`tenant.sbe.claimset:read|create|update|delete`).
   The seeded names live in the separate **ODS-Admin-API** repo
   (`EdFi.Ods.AdminApi.Common/Infrastructure/CloudOdsAdminApp.cs` and its E2E
   fixtures) and are written into the EdFi_Admin database by the Ed-Fi Admin API
   deployment, bypassing the API's own validation.

   Section 6's client-side validation makes this fail fast and legibly instead
   of after a server round-trip, which is the most this repo can do. The
   underlying inconsistency likely warrants a ticket against ODS-Admin-API.

## Scope summary

**In scope:** Claimset export (single + bulk) and import for V3-specification
tenants — two new `claimsetQueriesV3` members, removal of the `version === 'v2'`
gates, a version-aware export download URL, a new V3 import page and its route
branch, client-side name validation (V3 whitespace rule + shared 254-char
limit) with the import page's error-clearing bug fixed so it surfaces, and
V3-only helper text on the Copy form's Name field.

**Out of scope:** Claimset create/edit for V3 (still deferred — note the new
name validators only cover the Copy and Import DTOs; `PostClaimsetDtoV3` /
`PutClaimsetDtoV3` are untouched and should get the same treatment whenever
create/edit lands); cross-version file compatibility (limitation 1); changing
Copy's default name; any V1/V2 behavior change beyond adding `@MaxLength(254)`
and removing the version gates; the upstream ODS-Admin-API seed-data
inconsistency (limitation 2); any `packages/api` change.

Note this differs from the original plan in one respect: `packages/models` **is**
now in scope, for the validation decorators only (no shape changes).
