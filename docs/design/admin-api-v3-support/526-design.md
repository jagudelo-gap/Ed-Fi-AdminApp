# V3 Environment Sync Support — Design

Related: [526-task.md](./526-task.md) (AC-526), builds on AC-524 V3 scaffolding.

## Problem Statement

Admin App users can already create and update Ed-Fi environments that declare the V3 Admin
API specification, but the synchronization pipeline that pulls tenant/ODS-instance/education
organization data from the Admin API silently skips V3 environments. V3 environments save,
but their downstream data is never populated, leaving the environment unusable.

Research into the current implementation found the gap is not one missing feature but a set
of hardcoded `version === 'v1'` / `version === 'v2'` checks scattered across the create/update
service and the shared sync service, with V3 falling through as an unhandled or rejected case
at each one:

1. `SbEnvironmentsEdFiService.create()` has an `if/else if` on `'v1'`/`'v2'` with no `'v3'`
   branch — V3 environments save but are never queued for sync.
2. `configPublic` construction in `create()` is a binary v1/else ternary — V3 gets a
   V2-shaped `meta`, not the `SbV3MetaSaved` shape it should have.
3. `AdminApiSyncService.syncEnvironmentData()` / `syncTenantData()` explicitly reject any
   version other than `'v1'`/`'v2'` with an `INVALID_VERSION` result.
4. `provisionCredentialsForNewTenants()` / `bootstrapEnvironmentCredentials()` are gated to
   `version === 'v2'` only, but V3 multi-tenant environments need the same first-time
   credential bootstrap before `getTenants()` can authenticate.
5. `updateEnvironment()`'s re-sync trigger (`hasUrlUpdates && isV2Environment`) and its
   tenant-mode-lock `else` branch ("Starting Blocks or unknown version") don't recognize V3,
   so V3 falls into unknown-version defaults (e.g. a V3 multi-tenant environment would be
   incorrectly rejected when trying to keep `isMultitenant: true` on update).
6. `createClientCredentials()` hard-codes `&& version === 'v2'` for the multi-tenant
   tenant-header rule on `/connect/register` — a V3 multi-tenant environment currently would
   not get the `tenant` header even though it should.

Meanwhile, `AdminApiServiceV3` (from AC-524) already mirrors `AdminApiServiceV2` almost 1:1
in shape — same method names, same token-caching pattern, same credential shape
(`ISbEnvironmentConfigPrivateV2` is reused as-is). The V3 config shape
(`ISbEnvironmentConfigPublicV3`) is structurally identical to V2's except for the
`SbV3MetaSaved` meta type. Credential *saving* (`updateAdminApi()` in
`sb-environments-global.service.ts`) already treats `v3` the same as `v2` — this was fixed as
part of AC-524. The remaining gaps above are what's in scope for AC-526.

## Primary User

Admin App user provisioning or maintaining an Ed-Fi environment (an internal ops/admin
role), operating through the environment create/edit screens. Same audience already served
by V1/V2 environment creation — no new user type introduced.

## Job-to-be-Done

As an Admin App user, when I create or update an environment configured for the V3 Admin
API specification, I need the app to synchronize that environment's tenant, ODS instance,
and education organization data automatically — the same way it already does for V1 and V2
environments — so the environment is immediately usable after setup.

## Success Criteria

- A user can create an environment with the V3 specification and it saves successfully.
- After creating a V3 environment, its tenant/ODS-instance/education-organization data is
  automatically synchronized from the Admin API and visible in the environment detail view.
- A user can update a V3 environment's connection settings (e.g. Admin API URL) and the data
  re-synchronizes successfully.
- V1 and V2 environments continue to create, update, and synchronize exactly as they do
  today — no regression.
- Synchronized V3 data (tenants, ODS instances, education organizations) is persisted in the
  same database tables V1/V2 data already uses.

## Scope

**In scope:**

- Synchronizing a V3 environment's data when it is created.
- Synchronizing a V3 environment's data when it is updated (same "only re-sync on meaningful
  field changes" behavior already applied to V2).
- Any shared synchronization behavior that the create/update flows depend on, including the
  scheduled/periodic sync and the manual on-demand refresh action, to the extent they share
  the same underlying synchronization logic as create/update.
- Preserving existing V1 and V2 create, update, and synchronization behavior unchanged.
- Enforcing the same single-tenant/multi-tenant mode lock (cannot change after creation) for
  V3 environments that already applies to V1/V2.
- Persisting synchronized V3 data into the existing tenant/ODS-instance/education
  organization tables.
- Refactoring the scattered version-specific branching in `SbEnvironmentsEdFiService` and
  `AdminApiSyncService` into an explicit, symmetric version-strategy abstraction (see
  Architecture) so V1/V2/V3 are each handled by one clear implementation instead of ad hoc
  string checks.

**Out of scope for v1:**

- Any V3 frontend/UI work — V3 pages, routing, and frontend API integration are covered by
  separate tickets (AC-527–530).
- Starting Blocks–managed (lambda-based) environment synchronization — V3 environments are
  plain Admin API environments, so this path does not apply to them.

## Constraints

- New npm packages: not permitted. This feature must be implemented entirely with
  already-installed dependencies and existing services (notably the V3 Admin API service
  scaffolded under AC-524).
- Must not change observable V1 or V2 behavior in any way.
- Must not introduce a new V3-specific database schema — V3 data uses the existing
  tenant/ODS-instance/education-organization tables shared with V1/V2.

## Architecture

Introduce a single `AdminApiVersionStrategy` abstraction that replaces every scattered
`version === 'v1'/'v2'/'v3'` check across `SbEnvironmentsEdFiService` (create/update) and
`AdminApiSyncService` (sync dispatch, credential bootstrap) with one lookup.

- **Interface**: `AdminApiVersionStrategy`, defining the version-specific operations both
  services currently branch on.
- **Implementations**: `V1AdminApiVersionStrategy`, `V2AdminApiVersionStrategy`,
  `V3AdminApiVersionStrategy` — one class per version, each explicit. V1 becomes an explicit
  strategy instead of an implicit "everything that isn't v2" fallthrough.
- **Selection**: a small `AdminApiVersionStrategyFactory` (NestJS provider) maps a version
  string (`'v1' | 'v2' | 'v3'`) to its strategy instance. Both `SbEnvironmentsEdFiService` and
  `AdminApiSyncService` inject the factory instead of injecting `AdminApiServiceV1` /
  `AdminApiServiceV2` / `AdminApiServiceV3` directly.
- **V3's implementation is thin**: since V3 mirrors V2 almost exactly (same credential shape,
  same tenant-header rule, same job-queue dispatch), `V3AdminApiVersionStrategy` shares logic
  with `V2AdminApiVersionStrategy` (via a common base class or composition) rather than
  re-deriving it — the only real differences are which `AdminApiService` client it wraps and
  the V3 config/DTO shapes (`SbV3MetaSaved`, `ISbEnvironmentConfigPublicV3`).
- **V1 stays behaviorally identical** but becomes an explicit strategy (inline/synchronous
  sync, no job queue, no multi-tenant, no tenant-header) instead of an implicit fallthrough —
  this is a refactor of *where* the logic lives, not a change to *what* it does.

This keeps the fix scoped to introducing one clean seam, without altering the job-queue
mechanism, the DB schema, or any V1/V2 observable behavior.

## Components

`AdminApiVersionStrategy` interface (conceptual shape — exact method signatures get
finalized during implementation planning):

| Method | Purpose |
|---|---|
| `getAdminApiService()` | Returns the version's client (`AdminApiServiceV1/V2/V3`) for calls like `getTenants()`. |
| `buildConfigPublic(dto, meta)` | Constructs the version-shaped `configPublic.values` on create (replaces the binary v1/else ternary). |
| `getTenantModeDefault(existingEnv?)` | Resolves expected `isMultitenant` for the tenant-mode lock check on update (replaces the `isV1Environment`/`isV2Environment`/else chain). |
| `dispatchSync(sbEnvironment)` | Runs the create-time sync: V1 syncs inline and returns `{status}`; V2/V3 enqueue via job queue and return a polled `SbSyncQueue`. |
| `shouldTriggerResync(updateDto)` | The "meaningful field changed" gate (URL fields) — V1 handles this via its own inline path, V2/V3 via the job-queue trigger. |
| `getRegistrationHeaders(isMultitenant, tenant)` | Builds `/connect/register` headers (adds the `tenant` header only for versions that support multi-tenant). |
| `bootstrapCredentials(env, tenant)` | First-time credential provisioning before `getTenants()`; no-op for V1. |

`AdminApiVersionStrategyFactory.getStrategy(version: string)` throws/returns an
`INVALID_VERSION`-style result for anything outside `'v1'|'v2'|'v3'`, replacing today's ad hoc
`INVALID_VERSION` checks in `AdminApiSyncService`.

`V3AdminApiVersionStrategy` composes/extends `V2AdminApiVersionStrategy` for the shared
behaviors (tenant-header rule, credential bootstrap, job-queue dispatch, resync gate) and
overrides only `getAdminApiService()` and `buildConfigPublic()` to point at V3's client and
config shape.

## Data Flow

**Create flow:**
1. `SbEnvironmentsEdFiService.create()` detects `specificationVersion` (unchanged), looks up
   the strategy via the factory, and calls `strategy.buildConfigPublic()` instead of the
   binary ternary — this gives V3 a correct `SbV3MetaSaved` shape instead of borrowing V2's.
2. `createClientCredentials()` calls `strategy.getRegistrationHeaders(isMultitenant, tenant)`
   instead of the hardcoded `=== 'v2'` check — V3 multi-tenant environments now get the
   `tenant` header.
3. `create()` calls `strategy.dispatchSync(sbEnvironment)` in place of the
   `if 'v1' / else if 'v2'` block. For V1 this runs inline and returns immediately; for V2/V3
   it enqueues to `ENV_SYNC_CHNL` and polls `SbSyncQueue`, returning the same `syncQueue` DTO
   shape the client already polls today.

**Update flow:**
1. `updateEnvironment()` resolves the existing environment's strategy and calls
   `strategy.getTenantModeDefault(existingEnvironment)` for the tenant-mode lock check — V3
   now reads its own `meta.mode` instead of falling into the "unknown version → false"
   default.
2. `strategy.shouldTriggerResync(updateDto)` replaces `hasUrlUpdates && isV2Environment` —
   true for V2/V3 on URL change, handled via V1's own inline branch otherwise.
3. When resync is triggered, `strategy.dispatchSync()` is reused (same as create) to
   enqueue/poll.

**Scheduled sync / manual refresh:**
- `SbSyncConsumer.refreshSbEnvironment()` / `refreshEdfiTenant()` call
  `AdminApiSyncService.syncEnvironmentData()` / `syncTenantData()` unchanged at the call-site
  level. Internally, those methods now resolve the strategy via the factory (replacing the
  `version !== 'v1' && version !== 'v2'` rejection and the `version === 'v2'`
  credential-bootstrap block) and delegate to `strategy.getAdminApiService()` /
  `strategy.bootstrapCredentials()`. Since this is the same shared logic create/update depend
  on, V3 gets scheduled sync and manual refresh "for free" once the strategy is wired in —
  matching the confirmed assumption below.

## Error Handling

- **Unknown/missing version**: `AdminApiVersionStrategyFactory.getStrategy()` throws for
  anything outside `'v1'|'v2'|'v3'`; both `AdminApiSyncService` methods catch this and return
  the existing `{status: 'INVALID_VERSION', message: ...}` shape — same observable error
  contract as today, just sourced from the factory instead of an inline string comparison.
- **V3 Admin API errors** (auth failures, unreachable Admin API, malformed tenant/edorg
  responses): flow through the existing `AdminApiSyncService` try/catch and `SyncResult`
  status handling unchanged — `V3AdminApiVersionStrategy`'s `getAdminApiService()` just
  returns a different client; the calling code's error handling doesn't change.
- **Credential registration failures** for V3 (bad URL, network error on `/connect/register`):
  bubble up through the same paths V2 uses today (`createClientCredentials` /
  `bootstrapCredentials`), no new error branch needed since V3 reuses V2's registration
  mechanics via the shared base strategy.
- **Job-queue failures for V3** (job never reaches terminal state, polling timeout):
  identical to V2 today — `dispatchSync()` for V3 goes through the same enqueue/poll code, so
  the existing "synthetic active row on poll timeout" fallback applies unchanged.
- No new failure modes are introduced — the design's job is to route V3 through paths that
  already handle these errors for V2, not to add new error handling.

## Testing

- **Strategy unit tests**: one test suite per strategy (`V1AdminApiVersionStrategy`,
  `V2AdminApiVersionStrategy`, `V3AdminApiVersionStrategy`) verifying `buildConfigPublic`,
  `getTenantModeDefault`, `getRegistrationHeaders`, and `shouldTriggerResync` in isolation —
  this is where V3's correctness (V3 config shape, tenant-header rule, resync gate) gets
  pinned down directly.
- **Factory unit tests**: `getStrategy('v1'|'v2'|'v3')` returns the right implementation;
  unknown version throws/produces `INVALID_VERSION`.
- **Regression tests for V1/V2**: existing tests for `SbEnvironmentsEdFiService.create()` /
  `updateEnvironment()` and `AdminApiSyncService.syncEnvironmentData()` /
  `syncTenantData()` must continue passing unchanged — these serve as the "no V1/V2 behavior
  change" safety net. Any existing test asserting on the old inline `if/else` structure gets
  adapted to go through the strategy factory, but its assertions on *behavior* (inputs →
  outputs) stay the same.
- **New V3 integration-style tests**: mirroring existing V2 tests for `create()` (V3
  environment saves + enqueues job + returns syncQueue), `updateEnvironment()` (URL change
  triggers resync, tenant-mode lock enforced), and `AdminApiSyncService.syncEnvironmentData()`
  / `syncTenantData()` (V3 environment syncs tenant/ODS-instance/ed-org data into the shared
  tables) — directly validating the ticket's success criteria.
- No new test infrastructure needed — reuses existing Jest setup and mocking patterns already
  used for V1/V2 service tests.

## Confirmed Assumptions

- Creating a V3 environment queues and synchronizes it the same way a V2 environment is
  queued today (background job via the sync queue, with the create response returning a
  syncQueue status the client can poll), rather than a new dedicated code path.
- Updating a V3 environment triggers re-synchronization under the same condition already used
  for V2 — only when a field that affects the sync result actually changes (e.g. the
  ODS/Admin API URL), not on a name-only edit.
- V3 environments follow the same tenant-mode rule already enforced for V1/V2 —
  single-tenant vs. multi-tenant mode is locked in at creation and cannot be changed on
  update.
- Registering Admin API client credentials for a V3 environment reuses the same registration
  behavior already used for V2 (same endpoint, same tenant-header rule for multi-tenant),
  since V3's credential configuration shape is the same as V2's.
- Because the create and update flows for V3 depend on the same shared synchronization logic
  used by the scheduled sync job and the manual refresh action, fixing that shared logic to
  recognize V3 will also make those other entry points work correctly for V3 environments —
  this is expected and acceptable, not additional scope creep.

## Dependencies

- Builds on the V3 Admin API service scaffolding delivered in AC-524 (V3 DTOs, the V3 Admin
  API client/service, and V3 config shapes that mirror V2).
- Depends on the existing environment create/update controller and services, and the shared
  Admin API synchronization service that already handles V1 and V2.
- Depends on the existing job-queue-based sync dispatch mechanism (background sync jobs and
  polling) already used for V2 environment creation/updates.
