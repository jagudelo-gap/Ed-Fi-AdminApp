# ODS Instance Metadata Fields

**Date:** 2026-06-30
**Branch:** AC-540

## Background

The Admin API v2 endpoint `tenants/{name}/odsInstances/edOrgs` began returning four fields on each ODS instance that were previously absent or not persisted: `status`, `databaseTemplate`, `databaseName`, and `instanceType`. This work captures all four and persists them in the database.

## What Changed

**New nullable columns on the `ods` table**

| Column | Type | Description |
|---|---|---|
| `instanceType` | `varchar` / `NVARCHAR(255)` | Type of the ODS instance (e.g. Production, Sandbox) |
| `status` | `varchar` / `NVARCHAR(255)` | Operational status of the ODS instance |
| `databaseTemplate` | `varchar` / `NVARCHAR(255)` | Template used to provision the database |
| `databaseName` | `varchar` / `NVARCHAR(255)` | Actual database name |

**Database migration:** `1751299288000-AddOdsInstanceMetadataFields` (pgsql + mssql)

## Files Touched

| Layer | File |
|---|---|
| Shared DTO | `packages/models/src/dtos/edfi-admin-api.dto.ts` — `OdsInstanceDto` |
| Shared interface | `packages/models/src/interfaces/ods.interface.ts` — `IOds` |
| Entity | `packages/models-server/src/entities/ods.entity.ts` — `Ods` |
| ODS DTOs | `packages/models/src/dtos/ods.dto.ts` — `GetOdsDto`, `PutOdsDto`, `PostOdsDto` |
| Sync delta logic | `packages/api/src/sb-sync/sync-ods.ts` — `SyncableOds`, `computeOdsListDeltas` |
| Adapter utility | `packages/api/src/utils/admin-api-data-adapter-utils.ts` — `transformTenantData` |
| Sync service | `packages/api/src/sb-sync/edfi/adminapi-sync.service.ts` — `syncTenantData`, `processTenantData` |
| API v2 service | `packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service.ts` — `getTenants` |
| Migrations | `packages/api/src/database/migrations/pgsql/1751299288000-AddOdsInstanceMetadataFields.ts` |
| | `packages/api/src/database/migrations/mssql/1751299288000-AddOdsInstanceMetadataFields.ts` |

## Notes

- All four fields are nullable — if the API omits them, `null` is stored without error.
- The existing `dbName` column and its fallback logic are unchanged.
- Fields are **not** exposed via any GET endpoint at this time; persistence only.
- `instanceType` was already mapped at API boundaries but never persisted — added to the same migration.
