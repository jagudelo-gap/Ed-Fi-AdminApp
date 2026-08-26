import { GetApplicationDtoV2, GetApplicationDtoV3, GetIntegrationAppDto } from '@edanalytics/models';

// Split out from applicationConfig.ts so this type and its one pure helper
// have zero dependency on the query-builder chain (`../../api/queries/queries.v7`,
// which pulls in ESM-only packages Jest can't parse without extra config).
// Specs that mock `./applicationConfig` wholesale can still import the real
// `getDataStoreIds` from here without dragging that chain in.

// Both V2 and V3 application data carry the merged integration-app fields:
// V2 via useGetOneApplication.ts/useGetManyApplications.ts (requested via
// `getIntegrationAppDetails`), and V3 via AdminApiControllerV3.getApplications/
// getApplication (packages/api/.../v3/admin-api.v3.controller.ts), which merge
// the same IntegrationApp record into the response regardless of version.
// `GetApplicationDtoV3` doesn't declare these fields, but `plainToInstance`
// (packages/fe/src/app/api/methods.ts) runs without `excludeExtraneousValues`,
// so they reach the deserialized instance anyway — this type just makes that
// runtime reality explicit instead of forcing every consumer to `'x' in application`.
export type ApplicationEntity = (GetApplicationDtoV2 & GetIntegrationAppDto) | (GetApplicationDtoV3 & GetIntegrationAppDto);

// V2 applications carry `odsInstanceIds`; V3 applications carry `dataStoreIds`
// for the same concept. Centralized here so every consumer probes the field
// name the same way instead of reimplementing (and potentially disagreeing
// on) this discrimination — and so there's exactly one guard against either
// field being absent, rather than each call site remembering its own.
export const getDataStoreIds = (application: ApplicationEntity): number[] =>
  ('odsInstanceIds' in application ? application.odsInstanceIds : application.dataStoreIds) ?? [];
