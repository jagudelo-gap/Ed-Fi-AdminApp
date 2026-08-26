# ODS Create Async Flow - Implementation Summary

## What was implemented

The non-StartingBlocks ODS create flow now supports async Admin API behavior (`202 Accepted`) while keeping the UI and local data consistent.

### 1. Routing split for create flow

- **StartingBlocks environments** continue using the existing ODS create path.
- **Non-StartingBlocks environments** use Admin API v2 `dbinstances` create.

### 2. Backend orchestration after Admin API create

In `AdminApiControllerV2.postDbInstance`, after upstream create succeeds:

- A local ODS row is inserted.
- An environment sync job is queued on `ENV_SYNC_CHNL`.
- The endpoint returns the local ODS id for frontend flow continuity.

Inserted local ODS fields include:

- `edfiTenantId`
- `sbEnvironmentId`
- `odsInstanceId`
- `dbName` (from create name)
- `odsInstanceName` (from create name)
- `databaseTemplate` (from dropdown)
- `instanceType` (set from dropdown selection: `Minimal` or `Sample`)
- `status = PendingCreate`

### 3. Frontend create behavior

In `CreateOdsPage` for non-StartingBlocks:

- Submits `{ name, databaseTemplate }`.
- On success, redirects to ODS list page (parent path), not details.
- Invalidates the ODS list query key before redirect so the list refreshes immediately.

### 4. ODS list cache behavior

In `OdssPage`, the ODS list query is configured to avoid reused cache on revisit:

- `staleTime: 0`
- `gcTime: 0`

This ensures that after navigating away and returning, the list fetches fresh data.

## Test coverage added/updated

- `admin-api.v2.controller.spec.ts`
  - Verifies local ODS insert and sync enqueue behavior for non-SB create.
  - Verifies persisted `instanceType` mapping from template selection.
- `CreateOdsPage.spec.tsx`
  - Verifies non-SB create redirects to list page.
  - Verifies list query invalidation before redirect.
- `OdssPage.spec.tsx`
  - Verifies ODS list query uses `staleTime: 0` and `gcTime: 0`.

## Result

The async non-SB create path is now end-to-end consistent:

1. Create request accepted by Admin API.
2. Local ODS row appears with pending status and selected template/type metadata.
3. Sync job is triggered.
4. User is redirected to list view with fresh data loading behavior.
