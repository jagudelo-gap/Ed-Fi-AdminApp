# ODS `dbInstanceId` + Non-StartingBlocks Async Delete (Consolidated Brief)

> **Superseded naming (AC-579):** the identifiers below reflect this feature's original naming
> and are kept as-is for historical accuracy. AC-579 renamed them to match the Admin API's
> `/v2/odsInstances/manage` endpoint and added a proper migration instead of editing history
> (see "Important Caveat" below):
> - `dbInstanceId` (column/field) → `instanceManageId`
> - `postDbInstance` / `deleteDbInstance` (service/controller methods) → `postInstance` / `deleteInstance`
> - `dbInstancesV2` (FE query entity) → `instancesV2`
> - `PostDbInstanceDtoV2` → `PostInstanceDtoV2`

## Overview

This feature set extends ODS metadata and delete behavior for Admin API v2 integrations, focused on non-StartingBlocks environments:

1. Adds nullable integer `dbInstanceId` as persisted ODS metadata.
2. Implements async ODS delete by `dbInstanceId` for non-StartingBlocks environments.
3. Ensures sync pipelines and UI behavior correctly reflect background-job lifecycle states.

The changes were implemented from:
- `docs/superpowers/specs/2026-07-21-ods-dbinstanceid-design.md`
- `docs/superpowers/plans/2026-07-21-ods-dbinstanceid-backfill.md`
- `docs/superpowers/specs/2026-07-22-ods-non-sb-async-delete-design.md`
- `docs/superpowers/plans/2026-07-22-ods-non-sb-async-delete.md`

## What Was Added

### 1) `dbInstanceId` metadata support

- `dbInstanceId` is now part of ODS persistence and DTO contracts as `number | null`.
- The existing metadata migration `1751299288000-AddOdsInstanceMetadataFields` (pgsql + mssql) was updated to include `dbInstanceId` (nullable integer), per project direction to update existing migration rather than create a new one.
- Admin API v2 mapping, tenant data transformation, and sync-delta logic now include `dbInstanceId` with null normalization.

### 2) Non-StartingBlocks async delete by db instance

- New Admin API v2 delete path supports deleting by db instance ID for non-StartingBlocks flow.
- FE `dbInstancesV2.delete` query support was added and wired in both ODS list and detail actions.
- For non-StartingBlocks, delete is routed by `dbInstanceId`; StartingBlocks delete behavior remains unchanged.

### 3) Delete eligibility rules

For non-StartingBlocks environments, delete is available only when both are true:

- `dbInstanceId > 0`
- `status === 'Created'`

If either condition is not met, delete action is not exposed.

## Async Delete Lifecycle

For non-StartingBlocks delete:

1. User confirms delete.
2. UI immediately transitions local cached status to `PendingDelete`.
3. Backend accepts delete request keyed by `dbInstanceId`.
4. Sync/background processing reconciles final state.

This mirrors the existing async create model and avoids implying synchronous completion.

## Sync/Persistence Correction

An additional sync gap was addressed: one tenant-sync mapping path rebuilt ODS payloads without `dbInstanceId`, causing persisted null values despite Admin API responses containing valid IDs. The mapping now preserves `dbInstanceId` end-to-end before persistence.

## Validation Coverage (Targeted)

Targeted API/FE tests were expanded to cover:

- `dbInstanceId` propagation through mapping and sync.
- Delta behavior with `dbInstanceId` changes and null normalization.
- Non-StartingBlocks delete routing to `dbInstancesV2.delete`.
- Eligibility gating (`dbInstanceId > 0` and `status === 'Created'`).
- Immediate UI status transition to `PendingDelete` in cache after delete confirmation.

## Important Caveat

Because the existing migration file was modified in place (instead of introducing a new migration), environments that already executed that migration may require explicit schema alignment steps outside normal migration replay.

**AC-579 follow-up:** the `dbInstanceId` → `instanceManageId` rename hit this exact risk — the metadata migration had already shipped to `main` by the time of the rename. AC-579 added a new migration (`RenameDbInstanceIdToInstanceManageId`, pgsql + mssql) to rename the column, rather than editing the already-shipped migration file again.

