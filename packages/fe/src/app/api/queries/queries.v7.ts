import {
  ApiClientResponseV2,
  ApplicationResponseV2,
  CopyClaimsetDtoV2,
  CopyClaimsetDtoV3,
  GetApiClientDtoV2,
  GetApplicationDtoV2,
  GetApplicationDtoV3,
  GetClaimsetMultipleDtoV2,
  GetClaimsetMultipleDtoV3,
  GetClaimsetSingleDtoV2,
  GetClaimsetSingleDtoV3,
  GetDataStoreSummaryDtoV3,
  GetOdsInstanceSummaryDtoV2,
  GetProfileDtoV2,
  GetProfileDtoV3,
  GetVendorDtoV2,
  GetVendorDtoV3,
  Id,
  PostApiClientDtoV2,
  PostApiClientResponseDtoV2,
  PostInstanceDtoV2,
  ImportClaimsetSingleDtoV2,
  ImportClaimsetSingleDtoV3,
  PostApplicationFormDtoV2,
  PostApplicationFormDtoV3,
  PostApplicationResponseDtoV3,
  PostClaimsetDtoV2,
  PostProfileDtoV2,
  PostProfileDtoV3,
  PostVendorDtoV2,
  PostVendorDtoV3,
  PutApiClientDtoV2,
  PutApplicationFormDtoV2,
  PutApplicationFormDtoV3,
  PutClaimsetFormDtoV2,
  PutProfileDtoV2,
  PutProfileDtoV3,
  PutVendorDtoV2,
  PutVendorDtoV3,
} from '@edanalytics/models';
import { GetEdfiTenantDto } from '@edanalytics/models';
import { EntityQueryBuilder, queryKeyNew, standardPath } from './builder';
import { TeamOptions } from './team-options';

// See the comment above apiClientQueriesV2's `.delete(...)` call for why this
// shape (rather than the builder's declared `path` overload type) is needed.
type ApiClientDeletePathBase = {
  id: string | number;
  edfiTenant?: GetEdfiTenantDto;
  teamId?: string | number;
  queryParams?: {
    edfiTenant?: GetEdfiTenantDto;
    teamId?: string | number;
  };
};

export const applicationQueriesV2 = new EntityQueryBuilder({
  adminApi: true,
  name: 'Application',
  includeEdfiTenant: true,
  includeTeam: TeamOptions.Required,
})
  .getAll('getAll', { ResDto: GetApplicationDtoV2 })
  .getOne('getOne', { ResDto: GetApplicationDtoV2 })
  .put('put', { ResDto: GetApplicationDtoV2, ReqDto: PutApplicationFormDtoV2 })
  .put(
    'resetCreds',
    {
      ResDto: undefined as unknown as ApplicationResponseV2,
      ReqDto: Id,
    },
    (base) =>
      standardPath({
        edfiTenant: base.edfiTenant,
        teamId: base.teamId,
        kebabCaseName: 'application',
        adminApi: true,
        id: `${base.entity.id}/reset-credential`,
      })
  )
  .post('post', { ResDto: undefined as unknown as ApplicationResponseV2, ReqDto: PostApplicationFormDtoV2 })
  .delete('delete')
  .build();

export const applicationQueriesV3 = new EntityQueryBuilder({
  adminApi: true,
  name: 'Application',
  includeEdfiTenant: true,
  includeTeam: TeamOptions.Required,
})
  .getAll('getAll', { ResDto: GetApplicationDtoV3 })
  .getOne('getOne', { ResDto: GetApplicationDtoV3 })
  .put('put', { ResDto: GetApplicationDtoV3, ReqDto: PutApplicationFormDtoV3 })
  .post('post', { ResDto: PostApplicationResponseDtoV3, ReqDto: PostApplicationFormDtoV3 })
  .delete('delete')
  .build();

export const apiClientQueriesV2 = new EntityQueryBuilder({
  adminApi: true,
  name: 'ApiClient',
  includeEdfiTenant: true,
  includeTeam: TeamOptions.Required,
})
  .getAll(
    'getAll',
    { ResDto: GetApiClientDtoV2 },
    (base, extras: { applicationId?: number }) => {
      const query =
        extras?.applicationId === undefined
          ? ''
          : `?applicationId=${extras.applicationId}`;
      return standardPath({
        edfiTenant: base.edfiTenant,
        teamId: base.teamId,
        kebabCaseName: 'apiClient',
        adminApi: true,
        id: query,
      });
    }
  )
  .getOne('getOne', { ResDto: GetApiClientDtoV2 },
    (base) => {
      return standardPath({
        edfiTenant: base.edfiTenant,
        teamId: base.teamId,
        kebabCaseName: 'apiClient',
        adminApi: true,
        id: base.id,
      });
    })
  .put(
    'put',
    { ResDto: GetApiClientDtoV2, ReqDto: PutApiClientDtoV2 },
    (base) =>
      standardPath({
        edfiTenant: base.edfiTenant,
        teamId: base.teamId,
        kebabCaseName: 'apiClient',
        adminApi: true,
        id: base.entity.id,
      })
  )
  .put(
    'resetCreds',
    {
      ResDto: undefined as unknown as ApiClientResponseV2,
      ReqDto: Id,
    },
    (base) =>
      standardPath({
        edfiTenant: base.edfiTenant,
        teamId: base.teamId,
        kebabCaseName: 'apiClient',
        adminApi: true,
        id: `${base.entity.id}/reset-credential`,
      })
  )
  .post(
    'post',
    { ResDto: PostApiClientResponseDtoV2, ReqDto: PostApiClientDtoV2 },
    (base) =>
      standardPath({
        edfiTenant: base.edfiTenant,
        teamId: base.teamId,
        kebabCaseName: 'apiClient',
        adminApi: true,
      })
  )
  .delete(
    'delete',
    {},
    // The builder's `path` overload types its 3rd arg as a bare function, but the
    // runtime implementation (builder.ts's `delete()`) only recognizes it when it's
    // wrapped as `{ path: fn }` (it does `'path' in pathConfig`), and calls it with
    // either `{ queryParams, id }` (from mutationFn) or `{ ...queryParams, id }`
    // (from onSuccess) depending on caller - hence the dual `queryParams?.x ?? x`
    // lookups below. Cast through `unknown` (not `any`) since the declared overload
    // type doesn't describe this actual shape.
    {
      path: (base: ApiClientDeletePathBase) => {
        const edfiTenant = base.queryParams?.edfiTenant ?? base.edfiTenant;
        const teamId = base.queryParams?.teamId ?? base.teamId;
        return standardPath({
          edfiTenant,
          teamId,
          kebabCaseName: 'apiClient',
          adminApi: true,
          id: base.id,
        });
      },
    } as unknown as (
      base: { id: string | number },
      extras: unknown
    ) => string
  )
  .build();

export const claimsetQueriesV2 = new EntityQueryBuilder({
  adminApi: true,
  name: 'Claimset',
  includeEdfiTenant: true,
  includeTeam: TeamOptions.Required,
})
  .getOne('getOne', { ResDto: GetClaimsetSingleDtoV2 })
  .post(
    'createExport',
    { ResDto: Id, ReqDto: class Nothing {} },
    (base, pathParams: { ids: number[] }) =>
      standardPath({
        edfiTenant: base.edfiTenant,
        teamId: base.teamId,
        kebabCaseName: 'claimset',
        adminApi: true,
        id: `export?id=${pathParams.ids.join('&id=')}`,
      })
  )
  .getAll('getAll', { ResDto: GetClaimsetMultipleDtoV2 })
  .put('put', { ResDto: GetClaimsetSingleDtoV2, ReqDto: PutClaimsetFormDtoV2 })
  .post('post', { ResDto: GetClaimsetSingleDtoV2, ReqDto: PostClaimsetDtoV2 })
  .post(
    'import',
    {
      ResDto: Id,
      ReqDto: ImportClaimsetSingleDtoV2,
      keysToInvalidate: (base) => [
        queryKeyNew({
          ...base.standardQueryKeyParams,
          pathOverride: undefined,
          id: undefined,
        }),
      ],
    },
    (base) =>
      standardPath({
        edfiTenant: base.edfiTenant,
        teamId: base.teamId,
        kebabCaseName: 'claimset',
        adminApi: true,
        id: `import`,
      })
  )
  .post(
    'copy',
    {
      ResDto: Id,
      ReqDto: CopyClaimsetDtoV2,
      keysToInvalidate: (params) => [
        params.standard,
        queryKeyNew({
          kebabCaseName: 'claimset',
          edfiTenant: params.edfiTenant,
          id: false,
        }),
      ],
    },
    (base) =>
      standardPath({
        edfiTenant: base.edfiTenant,
        teamId: base.teamId,
        kebabCaseName: 'claimset',
        adminApi: true,
        id: `copy`,
      })
  )
  .delete('delete')
  .build();

export const claimsetQueriesV3 = new EntityQueryBuilder({
  adminApi: true,
  name: 'Claimset',
  includeEdfiTenant: true,
  includeTeam: TeamOptions.Required,
})
  .getOne('getOne', { ResDto: GetClaimsetSingleDtoV3 })
  .getAll('getAll', { ResDto: GetClaimsetMultipleDtoV3 })
  .post(
    'createExport',
    { ResDto: Id, ReqDto: class Nothing {} },
    (base, pathParams: { ids: number[] }) =>
      standardPath({
        edfiTenant: base.edfiTenant,
        teamId: base.teamId,
        kebabCaseName: 'claimset',
        adminApi: true,
        id: `export?id=${pathParams.ids.join('&id=')}`,
      })
  )
  .post(
    'import',
    {
      ResDto: Id,
      ReqDto: ImportClaimsetSingleDtoV3,
      keysToInvalidate: (base) => [
        queryKeyNew({
          ...base.standardQueryKeyParams,
          pathOverride: undefined,
          id: undefined,
        }),
      ],
    },
    (base) =>
      standardPath({
        edfiTenant: base.edfiTenant,
        teamId: base.teamId,
        kebabCaseName: 'claimset',
        adminApi: true,
        id: `import`,
      })
  )
  .post(
    'copy',
    {
      ResDto: Id,
      ReqDto: CopyClaimsetDtoV3,
      keysToInvalidate: (params) => [
        params.standard,
        queryKeyNew({
          kebabCaseName: 'claimset',
          edfiTenant: params.edfiTenant,
          id: false,
        }),
      ],
    },
    (base) =>
      standardPath({
        edfiTenant: base.edfiTenant,
        teamId: base.teamId,
        kebabCaseName: 'claimset',
        adminApi: true,
        id: `copy`,
      })
  )
  .delete('delete')
  .build();

export const vendorQueriesV2 = new EntityQueryBuilder({
  adminApi: true,
  name: 'Vendor',
  includeEdfiTenant: true,
  includeTeam: TeamOptions.Required,
})
  .getOne('getOne', { ResDto: GetVendorDtoV2 })
  .getAll('getAll', { ResDto: GetVendorDtoV2 })
  .put('put', { ResDto: GetVendorDtoV2, ReqDto: PutVendorDtoV2 })
  .post('post', { ResDto: Id, ReqDto: PostVendorDtoV2 })
  .delete('delete')
  .build();

export const vendorQueriesV3 = new EntityQueryBuilder({
  adminApi: true,
  name: 'Vendor',
  includeEdfiTenant: true,
  includeTeam: TeamOptions.Required,
})
  .getOne('getOne', { ResDto: GetVendorDtoV3 })
  .getAll('getAll', { ResDto: GetVendorDtoV3 })
  .put('put', { ResDto: GetVendorDtoV3, ReqDto: PutVendorDtoV3 })
  .post('post', { ResDto: Id, ReqDto: PostVendorDtoV3 })
  .delete('delete')
  .build();

export const profileQueriesV2 = new EntityQueryBuilder({
  adminApi: true,
  name: 'Profile',
  includeEdfiTenant: true,
  includeTeam: TeamOptions.Required,
})
  .getOne('getOne', { ResDto: GetProfileDtoV2 })
  .getAll('getAll', { ResDto: GetProfileDtoV2 })
  .put('put', { ResDto: GetProfileDtoV2, ReqDto: PutProfileDtoV2 })
  .post('post', { ResDto: GetProfileDtoV2, ReqDto: PostProfileDtoV2 })
  .delete('delete')
  .build();

export const profileQueriesV3 = new EntityQueryBuilder({
  adminApi: true,
  name: 'Profile',
  includeEdfiTenant: true,
  includeTeam: TeamOptions.Required,
})
  .getOne('getOne', { ResDto: GetProfileDtoV3 })
  .getAll('getAll', { ResDto: GetProfileDtoV3 })
  .put('put', { ResDto: GetProfileDtoV3, ReqDto: PutProfileDtoV3 })
  .post('post', { ResDto: GetProfileDtoV3, ReqDto: PostProfileDtoV3 })
  .delete('delete')
  .build();

export const odsInstancesV2 = new EntityQueryBuilder({
  adminApi: true,
  name: 'Odsinstance',
  includeEdfiTenant: true,
  includeTeam: TeamOptions.Required,
})
  .getAll('getAll', { ResDto: GetOdsInstanceSummaryDtoV2 })
  .build();

export const dataStoresV3 = new EntityQueryBuilder({
  adminApi: true,
  name: 'Datastore',
  includeEdfiTenant: true,
  includeTeam: TeamOptions.Required,
})
  .getAll('getAll', { ResDto: GetDataStoreSummaryDtoV3 })
  .build();

export const instancesV2 = new EntityQueryBuilder({
  adminApi: true,
  name: 'Instance',
  includeEdfiTenant: true,
  includeTeam: TeamOptions.Required,
})
  .post('post', { ResDto: Id, ReqDto: PostInstanceDtoV2 })
  .delete('delete')
  .build();
