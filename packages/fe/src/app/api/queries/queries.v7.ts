import {
  ApiClientResponseV2,
  ApplicationResponseV2,
  CopyClaimsetDtoV2,
  GetApiClientDtoV2,
  GetApplicationDtoV2,
  GetClaimsetMultipleDtoV2,
  GetClaimsetSingleDtoV2,
  GetOdsInstanceSummaryDtoV2,
  GetProfileDtoV2,
  GetVendorDtoV2,
  Id,
  ImportClaimsetSingleDtoV2,
  PostApiClientResponseDtoV2,
  PostApplicationFormDtoV2,
  PostClaimsetDtoV2,
  PostProfileDtoV2,
  PostVendorDtoV2,
  PutApiClientDtoV2,
  PutApplicationFormDtoV2,
  PutClaimsetFormDtoV2,
  PutProfileDtoV2,
  PutVendorDtoV2,
} from '@edanalytics/models';
import { EntityQueryBuilder, queryKeyNew, standardPath } from './builder';
import { TeamOptions } from './queries';

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
        kebabCaseName: 'apiclient',
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
        kebabCaseName: 'apiclient',
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
        kebabCaseName: 'apiclient',
        adminApi: true,
        id: base.entity.id,
      })
  )
  .post(
    'post',
    { ResDto: undefined as unknown as ApiClientResponseV2, ReqDto: PostApiClientResponseDtoV2 },
  )
  .delete(
    'delete',
    {},
    (base) =>
      standardPath({
        edfiTenant: base.edfiTenant,
        teamId: base.teamId,
        kebabCaseName: 'apiclient',
        adminApi: true,
        id: base.id,
      })
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

export const odsInstancesV2 = new EntityQueryBuilder({
  adminApi: true,
  name: 'Odsinstance',
  includeEdfiTenant: true,
  includeTeam: TeamOptions.Required,
})
  .getAll('getAll', { ResDto: GetOdsInstanceSummaryDtoV2 })
  .build();
