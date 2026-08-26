import { GetEdfiTenantDto, Id } from '@edanalytics/models';
import {
  QueryKey,
  UseMutationResult,
  UseQueryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { AxiosResponse } from 'axios';
import { ClassConstructor } from 'class-transformer';
import kebabCase from 'kebab-case';
import { methods } from '../methods';
import { TeamOptions } from './team-options';

export const queryFromEntity = <EntityType extends Id>(entity: EntityType) => ({
  data: { [entity.id]: entity },
});

export const standardPath = (params: {
  kebabCaseName: string;
  teamId?: number | string | undefined;
  edfiTenant?: GetEdfiTenantDto | undefined;
  sbEnvironmentId?: number | string | undefined;
  adminApi?: boolean | undefined;
  /** Applies after the standardized stem.
   *
   * Stem is up to and including `https://host:port/api/as/1/edfi-tenants/1/admin-api/v1/`,
   * depending on whether `teamId`, `edfiTenant`, and `adminApi` are present. So
   * override might be `applications/1/` or `applications/1/reset-credentials/`. If
   * you want to override the entire path after `/api/`, just instantiate some
   * queries that don't include any of `teamId`, `edfiTenant`, or `adminApi`.
   */
  pathOverride?: string | undefined;
  /** Can also accept arbitrary terminal path string */
  id?: string | number | undefined;
}) => {
  const { kebabCaseName, teamId, edfiTenant, sbEnvironmentId, adminApi, pathOverride, id } = params;
  const teamPath = teamId === undefined ? '' : `teams/${teamId}/`;
  const sbEnvironmentPath =
    sbEnvironmentId === undefined ? '' : `sb-environments/${sbEnvironmentId}/`;
  const edfiTenantPath = edfiTenant ? `edfi-tenants/${edfiTenant.id}/` : '';
  const adminApiPath = adminApi ? `admin-api/${edfiTenant?.sbEnvironment.version}/` : '';
  const namePath = `${kebabCaseName}s/`;
  const idPath = id === undefined ? '' : `${id}`;

  return pathOverride
    ? pathOverride
    : teamPath + sbEnvironmentPath + edfiTenantPath + adminApiPath + namePath + idPath;
};

type StandardQueryKeyParams = {
  kebabCaseName: string;
  teamId?: number | string | undefined;
  edfiTenant?: GetEdfiTenantDto | undefined;
  sbEnvironmentId?: number | string | undefined;
  adminApi?: boolean | undefined;
  pathOverride?: string | undefined;
  /** if `undefined`, uses "list" option. If `false`, omits to yield a partial (wildcard) key */
  id?: number | string | false;
};
/** Build standardized query key.
 *
 * Lists are keyed by `..., "list",...`. Details are keyed by `..., "detail-{id}",...`. Both
 * an entity's single list and its many detail caches can all be matched by passing `undefined`
 * as the `id` parameter to this function, as long as there is no `team` value. _Hint:
 * `team` should be included in the query, but not in mutation invalidations._
 *
 * If `undefined`, uses "list" option. If `false`, omits to yield a partial (wildcard) key */
export const queryKeyNew = (params: StandardQueryKeyParams) => {
  const { kebabCaseName, teamId, sbEnvironmentId, edfiTenant, adminApi, pathOverride, id } = params;
  const teamKey = teamId === undefined ? [] : ['teams', String(teamId)];
  const sbEnvironmentKey =
    sbEnvironmentId === undefined ? [] : ['sb-environments', String(sbEnvironmentId)];
  const edfiTenantKey = edfiTenant === undefined ? [] : ['edfi-tenants', String(edfiTenant?.id)];
  const adminApiKey = adminApi ? ['admin-api'] : [];
  const idKey = id === undefined ? ['list'] : id === false ? [] : [`detail-${id}`];
  const standardKey = [kebabCaseName + 's', ...idKey];

  return [
    ...sbEnvironmentKey,
    ...edfiTenantKey,
    ...adminApiKey,
    ...(pathOverride ? [pathOverride] : standardKey),
    ...teamKey,
  ];
};

type EdfiTenantParams = { edfiTenant: GetEdfiTenantDto };
type SbEnvironmentParams = { sbEnvironmentId: string | number };

type BaseGetDto = { id: number | string };

type BaseParams<
  TeamOptionsType extends TeamOptions,
  EdfiTenantOptionsType extends boolean,
  SbEnvironmentOptionsType
> = (EdfiTenantOptionsType extends true ? EdfiTenantParams : Record<never, never>) &
  (SbEnvironmentOptionsType extends true ? SbEnvironmentParams : Record<never, never>) &
  (TeamOptionsType extends TeamOptions.Required
    ? { teamId: number | string }
    : TeamOptionsType extends TeamOptions.Optional
    ? { teamId?: number | string | undefined }
    : Record<never, never>);

type BaseConfigParams =
  | {
      adminApi: true;
      includeEdfiTenant: true;
      includeTeam: TeamOptions.Required;
      includeSbEnvironment?: false | undefined;
    }
  | {
      adminApi?: false | undefined;
      includeEdfiTenant: boolean;
      includeTeam: TeamOptions;
      includeSbEnvironment?: false | undefined;
    }
  | {
      adminApi?: false | undefined;
      includeEdfiTenant: false;
      includeTeam: TeamOptions;
      includeSbEnvironment: true;
    };

type EntityQueryBuilderObject = object;

/**
 * Build a set of standardized or custom API queries for an entity. Add
 * queries to the set by method chaining. Comes with a lot of defualts,
 * but also supports custom URL factories and custom cache invalidations.
 *
 * There are three levels of config:
 * - baseConfig (for the whole set)
 * - extraConfig (specific to each chained method)
 * - queryParams (passed to the query upon usage)
 *
 * This allows the system as a whole to be as DRY as possible while still
 * highly configurable.
 *
 * Example:
```ts
const applicationQueries = new EntityQueryBuilder({
    adminApi: true,
    name: 'Application',
    includeEdfiTenant: true,
    includeTeam: TeamOptions.Required,
})
    .getOne('getOne', { ResDto: GetAppDto })
    .put('put', { ResDto: GetAppDto, ReqDto: PutAppDto })
    .put(
      'resetCreds',
      {
        ResDto: YopassResDto,
        ReqDto: Id,
        keysToInvalidate: (base) => [
        // ...keys
        ]
      },
      (base, extras) => '<path>'
    )
    .build();
```
 */
export class EntityQueryBuilder<
  T extends EntityQueryBuilderObject,
  ConfigType extends BaseConfigParams
> {
  private object: T;
  private baseConfig: ConfigType & { name: string };

  constructor(baseConfig: ConfigType & { name: string }) {
    this.object = {} as T;
    this.baseConfig = baseConfig;
  }
  getOne<K extends string, GetType extends object>(
    key: K,
    args: {
      ResDto: ClassConstructor<GetType>;
    }
  ): EntityQueryBuilder<
    T &
      Record<
        K,
        (
          queryParams: {
            id: number | string;
            enabled?: boolean;
          } & BaseParams<
            ConfigType['includeTeam'],
            ConfigType['includeEdfiTenant'],
            ConfigType['includeSbEnvironment']
          >
        ) => UseQueryOptions<GetType>
      >,
    ConfigType
  >;
  getOne<K extends string, GetType extends object, PathExtraParamsType>(
    key: K,
    args: {
      ResDto: ClassConstructor<GetType>;
    },
    /** Applies after the standardized stem.
     *
     * Stem is up to and including `https://host:port/api/as/1/edfi-tenants/1/admin-api/v1/`,
     * depending on whether `teamId`, `edfiTenant`, and `adminApi` are present. So
     * override might be `applications/1/` or `applications/1/reset-credentials/`. If
     * you want to override the entire path after `/api/`, just instantiate some
     * queries that don't include any of `teamId`, `edfiTenant`, or `adminApi`.
     */
    path: (
      base: {
        id: number | string;
        enabled?: boolean;
      } & BaseParams<
        ConfigType['includeTeam'],
        ConfigType['includeEdfiTenant'],
        ConfigType['includeSbEnvironment']
      >,
      extras: PathExtraParamsType
    ) => string
  ): EntityQueryBuilder<
    T &
      Record<
        K,
        (
          queryParams: {
            id: number | string;
            enabled?: boolean;
          } & BaseParams<
            ConfigType['includeTeam'],
            ConfigType['includeEdfiTenant'],
            ConfigType['includeSbEnvironment']
          >,
          pathParams: PathExtraParamsType
        ) => UseQueryOptions<GetType>
      >,
    ConfigType
  >;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getOne(key: any, extraConfig: any, pathConfig?: any) {
    const { ResDto } = extraConfig;
    const { adminApi, name } = this.baseConfig;
    const path = pathConfig;
    const kebabCaseName = kebabCase(name).slice(1);
    const queryFactory = (
      queryParams: {
        id: number | string;
        enabled?: boolean;
      } & BaseParams<
        ConfigType['includeTeam'],
        ConfigType['includeEdfiTenant'],
        ConfigType['includeSbEnvironment']
      >,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pathParams?: any
    ) => {
      const teamId = 'teamId' in queryParams ? queryParams.teamId : undefined;
      const sbEnvironmentId =
        'sbEnvironmentId' in queryParams ? queryParams.sbEnvironmentId : undefined;
      const edfiTenant = 'edfiTenant' in queryParams ? queryParams.edfiTenant : undefined;
      const pathOverride = path ? path(queryParams, pathParams) : undefined;
      return {
        throwOnError: true,
        enabled: queryParams.enabled === undefined || queryParams.enabled,
        queryKey: queryKeyNew({
          kebabCaseName,
          teamId,
          pathOverride,
          edfiTenant,
          sbEnvironmentId,
          id: queryParams.id,
        }),
        // TODO: maybe set initial data from many-item query
        queryFn: async () => {
          const url = standardPath({
            edfiTenant,
            kebabCaseName,
            teamId,
            sbEnvironmentId,
            adminApi,
            pathOverride,
            id: queryParams.id,
          });
          return await methods.getOne(url, ResDto);
        },
      };
    };

    Object.assign(this.object, {
      [key]: queryFactory,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this as any;
  }

  getAll<K extends string, GetType extends BaseGetDto>(
    key: K,
    args: {
      ResDto: ClassConstructor<GetType>;
    }
  ): EntityQueryBuilder<
    T &
      Record<
        K,
        (
          queryParams: {
            enabled?: boolean;
            optional?: boolean;
          } & BaseParams<
            ConfigType['includeTeam'],
            ConfigType['includeEdfiTenant'],
            ConfigType['includeSbEnvironment']
          >
        ) => UseQueryOptions<Record<string | number, GetType>>
      >,
    ConfigType
  >;
  getAll<K extends string, GetType extends BaseGetDto, PathExtraParamsType>(
    key: K,
    args: {
      ResDto: ClassConstructor<GetType>;
    },
    /** Applies after the standardized stem.
     *
     * Stem is up to and including `https://host:port/api/as/1/edfi-tenants/1/admin-api/v1/`,
     * depending on whether `teamId`, `edfiTenant`, and `adminApi` are present. So
     * override might be `applications/1/` or `applications/1/reset-credentials/`. If
     * you want to override the entire path after `/api/`, just instantiate some
     * queries that don't include any of `teamId`, `edfiTenant`, or `adminApi`.
     */
    path: (
      base: {
        enabled?: boolean;
      } & BaseParams<
        ConfigType['includeTeam'],
        ConfigType['includeEdfiTenant'],
        ConfigType['includeSbEnvironment']
      >,
      extras: PathExtraParamsType
    ) => string
  ): EntityQueryBuilder<
    T &
      Record<
        K,
        (
          queryParams: {
            enabled?: boolean;
          } & BaseParams<
            ConfigType['includeTeam'],
            ConfigType['includeEdfiTenant'],
            ConfigType['includeSbEnvironment']
          >,
          pathParams: PathExtraParamsType
        ) => UseQueryOptions<Record<string | number, GetType>>
      >,
    ConfigType
  >;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAll(key: any, extraConfig: any, pathConfig?: any) {
    const { ResDto } = extraConfig;
    const { adminApi, name } = this.baseConfig;
    const path = pathConfig;
    const kebabCaseName = kebabCase(name).slice(1);
    const queryFactory = (
      queryParams: {
        enabled?: boolean;
      } & BaseParams<
        ConfigType['includeTeam'],
        ConfigType['includeEdfiTenant'],
        ConfigType['includeSbEnvironment']
      >,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pathParams?: any
    ) => {
      const teamId = 'teamId' in queryParams ? queryParams.teamId : undefined;
      const sbEnvironmentId =
        'sbEnvironmentId' in queryParams ? queryParams.sbEnvironmentId : undefined;
      const edfiTenant = 'edfiTenant' in queryParams ? queryParams.edfiTenant : undefined;
      const pathOverride = path ? path(queryParams, pathParams) : undefined;
      return {
        throwOnError: true,
        enabled: queryParams.enabled === undefined || queryParams.enabled,
        queryKey: queryKeyNew({
          kebabCaseName,
          teamId,
          pathOverride,
          edfiTenant,
          sbEnvironmentId,
        }),
        queryFn: async () => {
          const url = standardPath({
            edfiTenant,
            kebabCaseName,
            teamId,
            sbEnvironmentId,
            adminApi,
            pathOverride,
          });
          return await methods.getManyMap(url, ResDto);
        },
      };
    };

    Object.assign(this.object, {
      [key]: queryFactory,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this as any;
  }

  put<K extends string, ResType extends object, ReqType extends BaseGetDto>(
    key: K,
    args: {
      ResDto: ClassConstructor<ResType>;
      ReqDto: ClassConstructor<ReqType>;
      keysToInvalidate?: (
        base: BaseParams<
          ConfigType['includeTeam'],
          ConfigType['includeEdfiTenant'],
          ConfigType['includeSbEnvironment']
        > & {
          entity: ReqType;
          standard: QueryKey;
          standardQueryKeyParams: StandardQueryKeyParams;
        }
      ) => QueryKey[];
    }
  ): EntityQueryBuilder<
    T &
      Record<
        K,
        (
          queryParams: BaseParams<
            ConfigType['includeTeam'],
            ConfigType['includeEdfiTenant'],
            ConfigType['includeSbEnvironment']
          >
        ) => UseMutationResult<ResType, unknown, { entity: ReqType }, unknown>
      >,
    ConfigType
  >;
  put<K extends string, ResType extends object, ReqType extends BaseGetDto, PathExtraParamsType>(
    key: K,
    args: {
      ResDto: ClassConstructor<ResType>;
      ReqDto: ClassConstructor<ReqType>;
      keysToInvalidate?: (
        base: BaseParams<
          ConfigType['includeTeam'],
          ConfigType['includeEdfiTenant'],
          ConfigType['includeSbEnvironment']
        > & {
          entity: ReqType;
          standard: QueryKey;
          standardQueryKeyParams: StandardQueryKeyParams;
        }
      ) => QueryKey[];
    },
    /** Applies after the standardized stem.
     *
     * Stem is up to and including `https://host:port/api/as/1/edfi-tenants/1/admin-api/v1/`,
     * depending on whether `teamId`, `edfiTenant`, and `adminApi` are present. So
     * override might be `applications/1/` or `applications/1/reset-credentials/`. If
     * you want to override the entire path after `/api/`, just instantiate some
     * queries that don't include any of `teamId`, `edfiTenant`, or `adminApi`.
     */
    path: (
      base: BaseParams<
        ConfigType['includeTeam'],
        ConfigType['includeEdfiTenant'],
        ConfigType['includeSbEnvironment']
      > & {
        entity: ReqType;
      },
      extras: PathExtraParamsType
    ) => string
  ): EntityQueryBuilder<
    T &
      Record<
        K,
        (
          queryParams: BaseParams<
            ConfigType['includeTeam'],
            ConfigType['includeEdfiTenant'],
            ConfigType['includeSbEnvironment']
          >
        ) => UseMutationResult<
          ResType,
          unknown,
          { entity: ReqType; pathParams: PathExtraParamsType },
          unknown
        >
      >,
    ConfigType
  >;

  put<K extends string, ResType, ReqType extends BaseGetDto, PathExtraParamsType>(
    key: K,
    args: {
      ResDto: ResType,
      ReqDto: ClassConstructor<ReqType>;
      keysToInvalidate?: (
        base: BaseParams<
          ConfigType['includeTeam'],
          ConfigType['includeEdfiTenant'],
          ConfigType['includeSbEnvironment']
        > & {
          entity: ReqType;
          standard: QueryKey;
          standardQueryKeyParams: StandardQueryKeyParams;
        }
      ) => QueryKey[];
    },
    path: (
      base: BaseParams<
        ConfigType['includeTeam'],
        ConfigType['includeEdfiTenant'],
        ConfigType['includeSbEnvironment']
      > & {
        entity: ReqType;
      },
      extras: PathExtraParamsType
    ) => string
  ): EntityQueryBuilder<
    T &
      Record<
        K,
        (
          queryParams: BaseParams<
            ConfigType['includeTeam'],
            ConfigType['includeEdfiTenant'],
            ConfigType['includeSbEnvironment']
          >
        ) => UseMutationResult<
          ResType,
          unknown,
          { entity: ReqType; pathParams: PathExtraParamsType },
          unknown
        >
      >,
    ConfigType
  >;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  put(key: any, extraConfig: any, pathConfig?: any) {
    const { ResDto, ReqDto, keysToInvalidate } = extraConfig;
    const { adminApi, name } = this.baseConfig;
    const path = pathConfig;
    const kebabCaseName = kebabCase(name).slice(1);
    const useMutationFactory = (
      queryParams: BaseParams<
        ConfigType['includeTeam'],
        ConfigType['includeEdfiTenant'],
        ConfigType['includeSbEnvironment']
      >
    ) => {
      const queryClient = useQueryClient();
      const teamId = 'teamId' in queryParams ? queryParams.teamId : undefined;
      const sbEnvironmentId =
        'sbEnvironmentId' in queryParams ? queryParams.sbEnvironmentId : undefined;
      const edfiTenant = 'edfiTenant' in queryParams ? queryParams.edfiTenant : undefined;
      return useMutation({
        mutationFn: ({ entity, pathParams }: { entity: Id; pathParams?: object }) => {
          const pathOverride = path ? path({ ...queryParams, entity }, pathParams) : undefined;
          return methods.put(
            standardPath({
              id: entity.id,
              edfiTenant,
              kebabCaseName,
              teamId,
              sbEnvironmentId,
              adminApi,
              pathOverride,
            }),
            ReqDto,
            ResDto,
            entity
          );
        },
        onSuccess: (data, { entity, pathParams }: { entity: Id; pathParams?: object }) => {
          const pathOverride = path ? path({ ...queryParams, entity }, pathParams) : undefined;
          // TODO: optionally configure cache update instead of invalidation

          const standardQueryKeyParams: StandardQueryKeyParams = {
            kebabCaseName,
            pathOverride,
            edfiTenant,
            sbEnvironmentId,
            id: false,
          };
          const standard = queryKeyNew(standardQueryKeyParams);
          if (keysToInvalidate) {
            keysToInvalidate({ ...queryParams, entity, standard, standardQueryKeyParams }).forEach(
              (key: QueryKey) => {
                queryClient.invalidateQueries({
                  queryKey: key,
                });
              }
            );
          } else {
            queryClient.invalidateQueries({
              queryKey: standard,
            });
          }
        },
      });
    };

    Object.assign(this.object, {
      [key]: useMutationFactory,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this as any;
  }

  post<K extends string, ResType extends object, ReqType extends object>(
    key: K,
    args: {
      ResDto: ClassConstructor<ResType>;
      ReqDto: ClassConstructor<ReqType>;
      keysToInvalidate?: (
        base: BaseParams<
          ConfigType['includeTeam'],
          ConfigType['includeEdfiTenant'],
          ConfigType['includeSbEnvironment']
        > & {
          entity: ReqType;
          standard: QueryKey;
          standardQueryKeyParams: StandardQueryKeyParams;
        }
      ) => QueryKey[];
    }
  ): EntityQueryBuilder<
    T &
      Record<
        K,
        (
          queryParams: BaseParams<
            ConfigType['includeTeam'],
            ConfigType['includeEdfiTenant'],
            ConfigType['includeSbEnvironment']
          >
        ) => UseMutationResult<ResType, unknown, { entity: ReqType }, unknown>
      >,
    ConfigType
  >;
  post<K extends string, ResType, ReqType extends object>(
    key: K,
    args: {
      ResDto: ResType;
      ReqDto: ClassConstructor<ReqType>;
      keysToInvalidate?: (
        base: BaseParams<
          ConfigType['includeTeam'],
          ConfigType['includeEdfiTenant'],
          ConfigType['includeSbEnvironment']
        > & {
          entity: ReqType;
          standard: QueryKey;
          standardQueryKeyParams: StandardQueryKeyParams;
        }
      ) => QueryKey[];
    }
  ): EntityQueryBuilder<
    T &
      Record<
        K,
        (
          queryParams: BaseParams<
            ConfigType['includeTeam'],
            ConfigType['includeEdfiTenant'],
            ConfigType['includeSbEnvironment']
          >
        ) => UseMutationResult<ResType, unknown, { entity: ReqType }, unknown>
      >,
    ConfigType
  >;
  post<K extends string, ResType extends object, ReqType extends object, PathExtraParamsType>(
    key: K,
    args: {
      ResDto: ClassConstructor<ResType>;
      ReqDto: ClassConstructor<ReqType>;
      keysToInvalidate?: (
        base: BaseParams<
          ConfigType['includeTeam'],
          ConfigType['includeEdfiTenant'],
          ConfigType['includeSbEnvironment']
        > & {
          entity: ReqType;
          standard: QueryKey;
          standardQueryKeyParams: StandardQueryKeyParams;
        }
      ) => QueryKey[];
    },
    /** Applies after the standardized stem.
     *
     * Stem is up to and including `https://host:port/api/as/1/edfi-tenants/1/admin-api/v1/`,
     * depending on whether `teamId`, `edfiTenant`, and `adminApi` are present. So
     * override might be `applications/1/` or `applications/1/reset-credentials/`. If
     * you want to override the entire path after `/api/`, just instantiate some
     * queries that don't include any of `teamId`, `edfiTenant`, or `adminApi`.
     */
    path: (
      base: BaseParams<
        ConfigType['includeTeam'],
        ConfigType['includeEdfiTenant'],
        ConfigType['includeSbEnvironment']
      > & {
        entity: ReqType;
      },
      extras: PathExtraParamsType
    ) => string
  ): EntityQueryBuilder<
    T &
      Record<
        K,
        (
          queryParams: BaseParams<
            ConfigType['includeTeam'],
            ConfigType['includeEdfiTenant'],
            ConfigType['includeSbEnvironment']
          >
        ) => UseMutationResult<
          ResType,
          unknown,
          { entity: ReqType; pathParams: PathExtraParamsType },
          unknown
        >
      >,
    ConfigType
  >;
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  post(key: any, extraConfig: any, pathConfig?: any) {
    const { ResDto, ReqDto, keysToInvalidate } = extraConfig;
    const { adminApi, name } = this.baseConfig;
    const path = pathConfig;
    const kebabCaseName = kebabCase(name).slice(1);
    const useMutationFactory = (
      queryParams: BaseParams<
        ConfigType['includeTeam'],
        ConfigType['includeEdfiTenant'],
        ConfigType['includeSbEnvironment']
      >
    ) => {
      const queryClient = useQueryClient();
      const teamId = 'teamId' in queryParams ? queryParams.teamId : undefined;
      const sbEnvironmentId =
        'sbEnvironmentId' in queryParams ? queryParams.sbEnvironmentId : undefined;
      const edfiTenant = 'edfiTenant' in queryParams ? queryParams.edfiTenant : undefined;
      return useMutation({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mutationFn: ({ entity, pathParams }: any) => {
          const pathOverride = path ? path({ ...queryParams, entity }, pathParams) : undefined;
          return methods.post(
            standardPath({
              edfiTenant,
              kebabCaseName,
              teamId,
              sbEnvironmentId,
              adminApi,
              pathOverride,
            }),
            ReqDto,
            ResDto,
            entity
          );
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onSuccess: (data, { entity, pathParams }: any) => {
          const pathOverride = path ? path({ ...queryParams, entity }, pathParams) : undefined;
          // TODO: optionally configure cache update instead of invalidation
          const standardQueryKeyParams: StandardQueryKeyParams = {
            kebabCaseName,
            pathOverride,
            edfiTenant,
            sbEnvironmentId,
            id: undefined,
          };
          const standard = queryKeyNew(standardQueryKeyParams);
          if (keysToInvalidate) {
            keysToInvalidate({ ...queryParams, entity, standard, standardQueryKeyParams }).forEach(
              (key: QueryKey) => {
                queryClient.invalidateQueries({
                  queryKey: key,
                });
              }
            );
          } else {
            queryClient.invalidateQueries({
              queryKey: standard,
            });
          }
        },
      });
    };

    Object.assign(this.object, {
      [key]: useMutationFactory,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this as any;
  }

  delete<K extends string>(
    key: K,
    args?: {
      keysToInvalidate?: (
        base: BaseParams<
          ConfigType['includeTeam'],
          ConfigType['includeEdfiTenant'],
          ConfigType['includeSbEnvironment']
        > & {
          id: string | number;
          standard: QueryKey;
          standardQueryKeyParams: StandardQueryKeyParams;
        }
      ) => QueryKey[];
    }
  ): EntityQueryBuilder<
    T &
      Record<
        K,
        (
          queryParams: BaseParams<
            ConfigType['includeTeam'],
            ConfigType['includeEdfiTenant'],
            ConfigType['includeSbEnvironment']
          >
        ) => UseMutationResult<
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          AxiosResponse<unknown, any>,
          unknown,
          { id: string | number },
          unknown
        >
      >,
    ConfigType
  >;
  delete<K extends string, PathExtraParamsType>(
    key: K,
    args: {
      keysToInvalidate?: (
        base: BaseParams<
          ConfigType['includeTeam'],
          ConfigType['includeEdfiTenant'],
          ConfigType['includeSbEnvironment']
        > & {
          id: string | number;
          standard: QueryKey;
          standardQueryKeyParams: StandardQueryKeyParams;
        }
      ) => QueryKey[];
    },
    /** Applies after the standardized stem.
     *
     * Stem is up to and including `https://host:port/api/as/1/edfi-tenants/1/admin-api/v1/`,
     * depending on whether `teamId`, `edfiTenant`, and `adminApi` are present. So
     * override might be `applications/1/` or `applications/1/reset-credentials/`. If
     * you want to override the entire path after `/api/`, just instantiate some
     * queries that don't include any of `teamId`, `edfiTenant`, or `adminApi`.
     */
    path: (
      base: BaseParams<
        ConfigType['includeTeam'],
        ConfigType['includeEdfiTenant'],
        ConfigType['includeSbEnvironment']
      > & {
        id: string | number;
      },
      extras: PathExtraParamsType
    ) => string
  ): EntityQueryBuilder<
    T &
      Record<
        K,
        (
          queryParams: BaseParams<
            ConfigType['includeTeam'],
            ConfigType['includeEdfiTenant'],
            ConfigType['includeSbEnvironment']
          >
        ) => UseMutationResult<
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          AxiosResponse<unknown, any>,
          unknown,
          { id: string | number; pathParams: PathExtraParamsType },
          unknown
        >
      >,
    ConfigType
  >;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete(key: any, extraConfig?: any, pathConfig?: any) {
    const { name, adminApi } = this.baseConfig;
    const { keysToInvalidate } = extraConfig || {};
    const path = pathConfig && 'path' in pathConfig ? pathConfig.path : undefined;
    const kebabCaseName = kebabCase(name).slice(1);
    const useMutationFactory = (
      queryParams: BaseParams<
        ConfigType['includeTeam'],
        ConfigType['includeEdfiTenant'],
        ConfigType['includeSbEnvironment']
      >
    ) => {
      const queryClient = useQueryClient();
      const teamId = 'teamId' in queryParams ? queryParams.teamId : undefined;
      const sbEnvironmentId =
        'sbEnvironmentId' in queryParams ? queryParams.sbEnvironmentId : undefined;
      const edfiTenant = 'edfiTenant' in queryParams ? queryParams.edfiTenant : undefined;
      return useMutation({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mutationFn: ({ id, pathParams }: any) => {
          const pathOverride = path ? path({ queryParams, id }, pathParams) : undefined;
          return methods.delete(
            standardPath({
              edfiTenant,
              kebabCaseName,
              teamId,
              sbEnvironmentId,
              adminApi,
              pathOverride,
              id,
            })
          );
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onSuccess: (data, { id, pathParams }: any) => {
          const pathOverride = path ? path({ ...queryParams, id }, pathParams) : undefined;
          // TODO: optionally configure cache update instead of invalidation
          const standardQueryKeyParams: StandardQueryKeyParams = {
            kebabCaseName,
            pathOverride,
            edfiTenant,
            sbEnvironmentId,
            id: undefined,
          };
          const standard = queryKeyNew(standardQueryKeyParams);
          if (keysToInvalidate) {
            keysToInvalidate({ ...queryParams, id, standard, standardQueryKeyParams }).forEach(
              (key: QueryKey) => {
                queryClient.invalidateQueries({
                  queryKey: key,
                });
              }
            );
          } else {
            queryClient.invalidateQueries({
              queryKey: standard,
            });
          }
        },
      });
    };

    Object.assign(this.object, {
      [key]: useMutationFactory,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this as any;
  }

  build(): T {
    return this.object;
  }
}
