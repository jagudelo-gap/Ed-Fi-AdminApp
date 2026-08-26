import {
  AddEdorgDtoV2,
  EnvNavDto,
  GetApplicationDto,
  GetClaimsetDto,
  GetEdfiTenantDto,
  GetEdorgDto,
  GetOdsDto,
  GetOwnershipDto,
  GetOwnershipViewDto,
  GetRoleDto,
  GetSbEnvironmentDto,
  GetTeamDto,
  GetUserDto,
  GetUserTeamMembershipDto,
  GetVendorDto,
  Id,
  Ids,
  OdsRowCountsDto,
  OdsTemplateOptionDto,
  OperationResultDto,
  PostApplicationForm,
  PostClaimsetDto,
  PostEdfiTenantDto,
  PostOdsDto,
  PostOwnershipDto,
  PostRoleDto,
  PostSbEnvironmentDto,
  PostSbEnvironmentResponseDto,
  PostTeamDto,
  PostUserDto,
  PostUserTeamMembershipDto,
  PostVendorDto,
  PrivilegeCode,
  PutApplicationForm,
  PutClaimsetDto,
  PutEdfiTenantAdminApi,
  PutEdfiTenantAdminApiRegister,
  PutOwnershipDto,
  PutRoleDto,
  PutSbEnvironmentDto,
  PutSbEnvironmentMeta,
  PutTeamDto,
  PutUserDto,
  PutUserTeamMembershipDto,
  PutVendorDto,
  SbSyncQueueDto,
  SpecificIds,
  ApplicationResponseV1,
  PutOdsDto,
  SyncEdOrgsResponseDto
} from '@edanalytics/models';
import { QueryKey, UseQueryOptions, useQueries } from '@tanstack/react-query';
import kebabCase from 'kebab-case';
import path from 'path-browserify';
import { authCacheKey } from '../../helpers';
import { apiClient } from '../methods';
import { EntityQueryBuilder, queryKeyNew, standardPath } from './builder';
import { TeamOptions } from './team-options';

const baseUrl = '';

/**
 * Add optional team to query key.
 *
 * Goes at the end, which means it's easier to refresh by EdfiTenant/Ods
 * than by team (i.e., easier to refresh upon resource updates
 * than upon team ownership updates).
 *
 * Standard key schema lists all resource hierarchy levels each in
 * the format of `[names, nameId]`. The target resource uses that
 * pattern as well, but also gets a `'list'` or `'detail'` string.
 * This way you can optionally target queries at any hierarchy
 * level without refetching deeply nested queries.
 *
 * ```
 * // Example using education organizations:
 * ['edfi-tenants', 3, 'edorgs', 6, 'detail']
 *
 * // To refetch EdfiTenant 3 without refetching its EdOrgs, use these keys:
 * ['edfi-tenants', 3, 'list']
 * ['edfi-tenants', 3, 'detail']
 *
 * // Or if you do want to refetch its children:
 * ['edfi-tenants', 3]
 * ```
 */
export const teamKey = (key: QueryKey, teamId?: number | string) =>
  teamId === undefined ? key : [...key, 'team', Number(teamId)];

/**
 *
 * Construct react-query query key in standard format.
 *
 * @return {string[]} query key
 *
 * @deprecated Use `queryKeyNew()` instead.
 *
 * @example
 * `["edfi-tenants", "3", "edorgs", "6", "detail"]` // EdOrg 6 of EdfiTenant 3
 * `["edfi-tenants", "3", "edorgs", "list"]` // All EdOrgs of EdfiTenant 3
 * `["edfi-tenants", "3", "detail"]` // EdfiTenant 3
 * `["edfi-tenants", "list"]` // All-EdfiTenant query
 * `["edfi-tenants"]` // All EdfiTenants both in single- and many-item queries
 *
 * `["edfi-tenants", "3", "edorgs", "6", "detail", "teams", "9"]` // EdOrg 6 of EdfiTenant 3, in Team 9 context
 * `["edfi-tenants", "3", "edorgs", "list", "teams", "9"]` // All EdOrgs of EdfiTenant 3, in Team 9 context
 * `["edfi-tenants", "3", "detail", "teams", "9"]` // EdfiTenant 3, in Team 9 context
 * `["edfi-tenants", "teams", "9"]` // All EdfiTenants, in Team 9 context
 */
export const queryKey = (params: {
  /** CamelCase or camelCase */
  resourceName: string;
  teamId?: number | string;
  edfiTenantId?: number | string;
  /** if `undefined`, uses "list" option. If `false`, omits to yield a partial (wildcard) key */
  id?: number | string | false;
}) => {
  const kebabCaseName = kebabCase(params.resourceName).slice(1);
  const teamKey = params.teamId === undefined ? [] : ['teams', String(params.teamId)];
  const edfiTenantKey =
    params.edfiTenantId === undefined ? [] : ['edfi-tenants', String(params.edfiTenantId)];
  const idKey =
    params.id === undefined ? ['list'] : params.id === false ? [] : ['detail', String(params.id)];

  return [...edfiTenantKey, kebabCaseName + 's', ...idKey, ...teamKey];
};

export const teamUrl = (url: string, teamId?: number | string | undefined) =>
  teamId === undefined ? path.join(baseUrl, url) : path.join(baseUrl, 'teams', String(teamId), url);

export type EdfiTenantParamsType<IncludeEdfiTenant extends boolean> = IncludeEdfiTenant extends true
  ? { edfiTenantId: number | string }
  : object;

export const edorgQueries = new EntityQueryBuilder({
  name: 'Edorg',
  includeEdfiTenant: true,
  includeTeam: TeamOptions.Optional,
})
  .getOne('getOne', { ResDto: GetEdorgDto })
  .getAll('getAll', { ResDto: GetEdorgDto })
  .post('post', { ReqDto: AddEdorgDtoV2, ResDto: class Nothing {} })
  .delete('delete')
  .post(
    'syncEdOrgs',
    {
      ReqDto: class {},
      ResDto: SyncEdOrgsResponseDto,
      keysToInvalidate: (params) => [
        queryKey({
          resourceName: 'Edorg',
          edfiTenantId: params.edfiTenant.id,
          id: false,
        }),
      ],
    },
    (base) =>
      standardPath({
        edfiTenant: base.edfiTenant,
        teamId: base.teamId,
        kebabCaseName: 'edorg',
        id: 'sync-edorgs',
      })
  )
  .build();

export const odsQueries = new EntityQueryBuilder({
  name: 'Ods',
  includeEdfiTenant: true,
  includeTeam: TeamOptions.Optional,
})
  .getOne('getOne', { ResDto: GetOdsDto })
  .getAll('getAll', { ResDto: GetOdsDto })
  .post('post', {
    ReqDto: PostOdsDto,
    ResDto: GetOdsDto,
    keysToInvalidate: (params) => [
      params.standard,
      queryKey({
        resourceName: 'Edorg',
        edfiTenantId: params.edfiTenant.id,
        id: false,
      }),
    ],
  })
  .put('put', { ReqDto: PutOdsDto, ResDto: GetOdsDto })
  .delete('delete', {
    keysToInvalidate: (params) => [
      params.standard,
      queryKey({
        resourceName: 'Edorg',
        edfiTenantId: params.edfiTenant.id,
        id: false,
      }),
    ],
  })
  .getAll('rowCounts', { ResDto: OdsRowCountsDto }, (base, { odsId }: { odsId: string }) =>
    standardPath({
      edfiTenant: base.edfiTenant,
      teamId: base.teamId,
      kebabCaseName: 'ods',
      id: `${odsId}/row-count`,
    })
  )
  .post(
    'syncEdOrgs',
    {
      ReqDto: class {},
      ResDto: class {},
      keysToInvalidate: (params) => [
        queryKeyNew({
          kebabCaseName: 'edorg',
          edfiTenant: params.edfiTenant,
          id: false,
        }),
      ],
    },
    (base, { odsId }: { odsId: string }) =>
      standardPath({
        edfiTenant: base.edfiTenant,
        teamId: base.teamId,
        kebabCaseName: 'ods',
        id: `${odsId}/sync-edorgs`,
      })
  )
  .build();

export const ownershipQueries = new EntityQueryBuilder({
  name: 'Ownership',
  includeEdfiTenant: false,
  includeTeam: TeamOptions.Optional,
})
  .getOne('getOne', { ResDto: GetOwnershipDto })
  .getAll('getAll', { ResDto: GetOwnershipViewDto })
  .put('put', { ReqDto: PutOwnershipDto, ResDto: GetOwnershipDto })
  .post('post', { ReqDto: PostOwnershipDto, ResDto: GetOwnershipDto })
  .delete('delete')
  .build();

export const roleQueries = new EntityQueryBuilder({
  name: 'Role',
  includeEdfiTenant: false,
  includeTeam: TeamOptions.Optional,
})
  .getOne('getOne', { ResDto: GetRoleDto })
  .getAll('getAll', { ResDto: GetRoleDto })
  .put('put', { ReqDto: PutRoleDto, ResDto: GetRoleDto })
  .post('post', { ReqDto: PostRoleDto, ResDto: GetRoleDto })
  .delete('delete', {
    keysToInvalidate: (params) => [
      params.standard,
      queryKey({
        resourceName: 'UserTeamMembership',
        id: false,
      }),
      queryKey({
        resourceName: 'User',
        id: false,
      }),
      queryKey({
        resourceName: 'Ownership',
        id: false,
      }),
    ],
  })
  .delete(
    'deleteForce',
    {
      keysToInvalidate: (params) => [
        params.standard,
        queryKey({
          resourceName: 'UserTeamMembership',
          id: false,
        }),
        queryKey({
          resourceName: 'User',
          id: false,
        }),
        queryKey({
          resourceName: 'Ownership',
          id: false,
        }),
      ],
    },
    (base) => `${baseUrl}/roles/${base.id}?force=true`
  )
  .build();

export const sbEnvironmentQueriesGlobal = new EntityQueryBuilder({
  name: 'SbEnvironment',
  includeEdfiTenant: false,
  includeTeam: TeamOptions.Optional,
})
  .getOne('getOne', { ResDto: GetSbEnvironmentDto })
  .getAll('getAll', { ResDto: GetSbEnvironmentDto })
  .put('put', { ReqDto: PutSbEnvironmentDto, ResDto: GetSbEnvironmentDto })
  .put(
    'registerMeta',
    { ReqDto: PutSbEnvironmentMeta, ResDto: GetSbEnvironmentDto },
    (base) => `${baseUrl}/sb-environments/${base.entity.id}/meta-arn`
  )
  .post('post', { ReqDto: PostSbEnvironmentDto, ResDto: PostSbEnvironmentResponseDto })
  .delete('delete', {
    keysToInvalidate: (params) => [
      params.standard,
      queryKeyNew({
        kebabCaseName: 'ownership',
        id: false,
      }),
    ],
  })
  .put(
    'refreshResources',
    {
      ReqDto: Id,
      ResDto: SbSyncQueueDto,
      keysToInvalidate: (params) => [
        ['sb-sync-queues'],
        queryKeyNew({
          ...params.standardQueryKeyParams,
          pathOverride: undefined,
        }),
        // Invalidate all tenant-scoped queries (ODS, EdOrgs, etc.) since any
        // tenant in this environment may have been updated by the sync.
        ['edfi-tenants'],
      ],
    },
    (base) => `${baseUrl}/sb-environments/${base.entity.id}/refresh-resources`
  )
  .put(
    'reloadTenants',
    { ReqDto: Id, ResDto: OperationResultDto },
    (base) => `${baseUrl}/sb-environments/${base.entity.id}/reload-tenants`
  )
  .build();

export const sbEnvironmentQueries = new EntityQueryBuilder({
  name: 'SbEnvironment',
  includeEdfiTenant: false,
  includeTeam: TeamOptions.Optional,
})
  .getOne('getOne', { ResDto: GetSbEnvironmentDto })
  .getAll('getAll', { ResDto: GetSbEnvironmentDto })
  .put('put', { ReqDto: PutSbEnvironmentDto, ResDto: GetSbEnvironmentDto })
  .put('registerMeta', { ReqDto: PutSbEnvironmentMeta, ResDto: GetSbEnvironmentDto })
  .post('post', { ReqDto: PostSbEnvironmentDto, ResDto: PostSbEnvironmentResponseDto })
  .post('checkEdFiVersionAndTenantMode', { ReqDto: Object, ResDto: Object }, () => `${baseUrl}/sb-environments/checkEdFiVersionAndTenantMode`)
  .post('validateAdminApiUrl', { ReqDto: Object, ResDto: Object }, () => `${baseUrl}/sb-environments/validateAdminApiUrl`)
  .delete('delete')
  .build();

export const odsTemplateQueries = new EntityQueryBuilder({
  name: 'OdsTemplate',
  includeEdfiTenant: false,
  includeTeam: TeamOptions.Required,
  includeSbEnvironment: true,
})
  .getAll('getAll', { ResDto: OdsTemplateOptionDto })
  .build();

export const edfiTenantQueriesGlobal = new EntityQueryBuilder({
  name: 'EdfiTenant',
  includeEdfiTenant: false,
  includeTeam: TeamOptions.Never,
  includeSbEnvironment: true,
})
  .getOne('getOne', { ResDto: GetEdfiTenantDto })
  .getAll('getAll', { ResDto: GetEdfiTenantDto })
  .post('post', { ReqDto: PostEdfiTenantDto, ResDto: GetEdfiTenantDto })
  .put(
    'v2Keygen',
    { ReqDto: Id, ResDto: OperationResultDto },
    (base) =>
      `${baseUrl}/sb-environments/${base.sbEnvironmentId}/edfi-tenants/${base.entity.id}/admin-api-v2-keygen`
  )
  .put(
    'registerApiManual',
    { ReqDto: PutEdfiTenantAdminApi, ResDto: OperationResultDto },
    (base) =>
      `${baseUrl}/sb-environments/${base.sbEnvironmentId}/edfi-tenants/${base.entity.id}/update-admin-api`
  )
  .put(
    'registerApiAuto',
    { ReqDto: PutEdfiTenantAdminApiRegister, ResDto: OperationResultDto },
    (base) =>
      `${baseUrl}/sb-environments/${base.sbEnvironmentId}/edfi-tenants/${base.entity.id}/register-admin-api`
  )
  .put(
    'refreshResources',
    {
      ReqDto: Id,
      ResDto: SbSyncQueueDto,
      keysToInvalidate: (params) => [
        ['sb-sync-queues'],
        // Invalidate ODS and EdOrg caches for this specific tenant so the UI
        // reflects the completed sync immediately without needing a page reload.
        queryKeyNew({
          kebabCaseName: 'ods',
          edfiTenant: params.entity as unknown as GetEdfiTenantDto,
          id: false,
        }),
        queryKeyNew({
          kebabCaseName: 'edorg',
          edfiTenant: params.entity as unknown as GetEdfiTenantDto,
          id: false,
        }),
      ],
    },
    (base) =>
      `${baseUrl}/sb-environments/${base.sbEnvironmentId}/edfi-tenants/${base.entity.id}/refresh-resources`
  )
  .put(
    'checkConnection',
    { ReqDto: Id, ResDto: OperationResultDto },
    (base) =>
      `${baseUrl}/sb-environments/${base.sbEnvironmentId}/edfi-tenants/${base.entity.id}/check-admin-api`
  )
  .delete('delete')
  .build();

export const edfiTenantQueries = new EntityQueryBuilder({
  name: 'EdfiTenant',
  includeEdfiTenant: false,
  includeTeam: TeamOptions.Required,
  includeSbEnvironment: true,
})
  .getOne('getOne', { ResDto: GetEdfiTenantDto })
  .getAll('getAll', { ResDto: GetEdfiTenantDto })
  .post('post', { ReqDto: PostEdfiTenantDto, ResDto: GetEdfiTenantDto })
  .delete('delete')
  .build();

export const teamQueries = new EntityQueryBuilder({
  name: 'Team',
  includeEdfiTenant: false,
  includeTeam: TeamOptions.Never,
})
  .getOne('getOne', { ResDto: GetTeamDto })
  .getAll('getAll', { ResDto: GetTeamDto })
  .put('put', { ReqDto: PutTeamDto, ResDto: GetTeamDto })
  .post('post', { ReqDto: PostTeamDto, ResDto: GetTeamDto })
  .getAll(
    'navSearchList',
    { ResDto: EnvNavDto },
    (base, extras: { teamId: number }) => `${baseUrl}/teams/${extras.teamId}/env-nav`
  )
  .delete('delete')
  .build();

export const userQueries = new EntityQueryBuilder({
  name: 'User',
  includeEdfiTenant: false,
  includeTeam: TeamOptions.Optional,
})
  .getOne('getOne', { ResDto: GetUserDto })
  .getAll('getAll', { ResDto: GetUserDto })
  .put('put', { ReqDto: PutUserDto, ResDto: GetUserDto })
  .post('post', { ReqDto: PostUserDto, ResDto: GetUserDto })
  .delete('delete')
  .build();

export const userTeamMembershipQueries = new EntityQueryBuilder({
  name: 'UserTeamMembership',
  includeEdfiTenant: false,
  includeTeam: TeamOptions.Optional,
})
  .getOne('getOne', { ResDto: GetUserTeamMembershipDto })
  .getAll('getAll', { ResDto: GetUserTeamMembershipDto })
  .put('put', { ReqDto: PutUserTeamMembershipDto, ResDto: GetUserTeamMembershipDto })
  .post('post', { ReqDto: PostUserTeamMembershipDto, ResDto: GetUserTeamMembershipDto })
  .delete('delete')
  .build();

export const vendorQueriesV1 = new EntityQueryBuilder({
  name: 'Vendor',
  adminApi: true,
  includeEdfiTenant: true,
  includeTeam: TeamOptions.Required,
})
  .getOne('getOne', { ResDto: GetVendorDto })
  .getAll('getAll', { ResDto: GetVendorDto })
  .put('put', { ResDto: GetVendorDto, ReqDto: PutVendorDto })
  .post('post', { ResDto: GetVendorDto, ReqDto: PostVendorDto })
  .delete('delete')
  .build();

export const applicationQueriesV1 = new EntityQueryBuilder({
  name: 'Application',
  adminApi: true,
  includeEdfiTenant: true,
  includeTeam: TeamOptions.Required,
})
  .getOne('getOne', { ResDto: GetApplicationDto })
  .getAll('getAll', { ResDto: GetApplicationDto })
  .put('put', {
    ResDto: GetApplicationDto,
    ReqDto: PutApplicationForm,
    keysToInvalidate: (params) => [
      params.standard,
      queryKeyNew({
        ...params.standardQueryKeyParams,
        kebabCaseName: 'claimset',
        id: false,
      }),
    ],
  })
  .put('resetCredential', { ResDto: undefined as unknown as ApplicationResponseV1, ReqDto: Id }, (base) =>
    standardPath({
      edfiTenant: base.edfiTenant,
      teamId: base.teamId,
      kebabCaseName: 'application',
      adminApi: true,
      id: `${base.entity.id}/reset-credential`,
    })
  )
  .post('post', { ResDto: undefined as unknown as ApplicationResponseV1, ReqDto: PostApplicationForm })
  .delete('delete')
  .build();

export const claimsetQueriesV1 = new EntityQueryBuilder({
  name: 'Claimset',
  adminApi: true,
  includeEdfiTenant: true,
  includeTeam: TeamOptions.Required,
})
  .getOne('getOne', { ResDto: GetClaimsetDto })
  .getAll('getAll', { ResDto: GetClaimsetDto })
  .put('put', { ResDto: GetClaimsetDto, ReqDto: PutClaimsetDto })
  .post('post', { ResDto: GetClaimsetDto, ReqDto: PostClaimsetDto })
  .delete('delete')
  .build();

export const sbSyncQueueQueries = new EntityQueryBuilder({
  name: 'SbSyncQueue',
  includeSbEnvironment: false,
  includeEdfiTenant: false,
  includeTeam: TeamOptions.Never,
})
  .getOne('getOne', { ResDto: SbSyncQueueDto })
  .build();

export const privilegeSelector = (res: SpecificIds | true | false) => {
  return Array.isArray(res) ? new Set(res) : res;
};

export function usePrivilegeCache<
  ConfigType extends {
    privilege: PrivilegeCode;
    teamId?: string | number;
    edfiTenantId?: string | number;
    sbEnvironmentId?: string | number;
  }
>(config: ConfigType[]) {
  const wholeCache = usePrivilegeCacheQueryNew(config.map((c) => ({ ...c, privilege: undefined })));
  return wholeCache.map((cache, i) => {
    const data = cache.data?.[config[i].privilege];
    return {
      ...cache,
      data,
    };
  });
}

export type FeAuthCache = Partial<Record<PrivilegeCode, Ids>>;
export const authCachArraysToSets = (res: FeAuthCache) => {
  const d: FeAuthCache = res;
  Object.keys(d).forEach((key) => {
    const v = d[key as PrivilegeCode];
    if (Array.isArray(v)) {
      d[key as PrivilegeCode] = new Set(v);
    }
  });
  return d;
};
export function usePrivilegeCacheQueryNew<
  ConfigType extends {
    teamId?: string | number;
    edfiTenantId?: string | number;
    sbEnvironmentId?: string | number;
  }
>(config: ConfigType[]) {
  return useQueries({
    queries: config.map((c): UseQueryOptions<FeAuthCache> => {
      return {
        staleTime: 90 * 1000,
        notifyOnChangeProps: ['data' as const],
        queryKey: authCacheKey(c),
        select: authCachArraysToSets,
        queryFn: () => {
          const queryParams = new URLSearchParams();
          if (c.edfiTenantId !== undefined) {
            queryParams.set('edfiTenantId', String(c.edfiTenantId));
          }
          if (c.sbEnvironmentId !== undefined) {
            queryParams.set('sbEnvironmentId', String(c.sbEnvironmentId));
          }
          const query = queryParams.toString();
          return apiClient.get(
            `/auth/cache${c.teamId !== undefined ? `/${c.teamId}` : ''}${
              query === '' ? '' : `?${query}`
            }`
          );
        },
      };
    }),
  });
}
