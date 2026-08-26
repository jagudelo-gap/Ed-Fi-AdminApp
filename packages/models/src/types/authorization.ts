import { IEdfiTenant, ISbEnvironment } from '../interfaces';
import {
  BasePrivilege,
  IntegrationProviderPrivilege,
  TeamBasePrivilege,
  TeamEdfiTenantPrivilege,
  TeamSbEnvironmentPrivilege,
} from './privilege.type';
import { PrivilegeCode } from './privileges';

export type AuthorizationCache = Partial<Record<BasePrivilege, TrueValue>> & ITeamCache;

export type TrueValue = true;
export type SpecificIds = Set<number | string>;
export type Ids = SpecificIds | TrueValue;

export const isAll = (ids: Ids): ids is TrueValue => typeof ids === 'boolean' && ids;

/*

TODO The code around privileges and authorization rule helpers is an ungainly mixture of TS utilities, non-DRY object maps, and function overloads. There's probably a way to make it much better, but watch out for the usability. We've abandoned a couple DRYer refactors already because of what they did to intellisense.

  a) separately type both EdfiTenant-nested and non-EdfiTenant-nested privilege strings, to power the overloads
  b) type the "child segment" of those "full" strings (e.g. edorg.application:read is the child segment of team.sb-environment.edfi-tenant.ods.edorg.application:read)
  c) map the full strings onto the child segment
  d) map the full strings onto the parent segment (e.g. team.sb-environment.edfi-tenant)
  e) type the "resource segment" of the both the EdfiTenant-nested and non-EdfiTenant-nested full privilege strings (e.g. team.ownership for team.ownership:read, or edorg.application for team.sb-environment.edfi-tenant.ods.edorg.application)
  f) map the "resource segment" strings onto arrays of all associated privileges
  g) provide good typing hints. Sometimes you can find a more DRY way of getting a type, but it loses the nice intellisense compared to explicit string unions.
  h) support the different overloads for EdfiTenant vs non-EdfiTenant privileges passed into the helpers.
  i) specify `true` as the sole possible value where appropriate (i.e. for `create` privileges)

*/

// TODO replace most of this file with codegen and/or dynamic functions

/** @deprecated to be replaced with codegen */
export type EdfiTenantSubEntityPrivilege =
  | 'vendor:read'
  | 'vendor:update'
  | 'vendor:delete'
  | 'vendor:create'
  | 'claimset:read'
  | 'claimset:update'
  | 'claimset:delete'
  | 'claimset:create'
  | 'profile:read'
  | 'profile:update'
  | 'profile:delete'
  | 'profile:create'
  | 'ods:read'
  | 'ods:read-row-counts'
  | 'edorg:read'
  | 'edorg.application:read'
  | 'edorg.application:update'
  | 'edorg.application:delete'
  | 'edorg.application:create'
  | 'edorg.application:reset-credentials';

const integrationProviderPrivileges: Record<IntegrationProviderPrivilege, true> = {
  'integration-provider:read': true,
  'integration-provider:update': true,
  'integration-provider:delete': true,
  'integration-provider:create': true,
};

/** @deprecated to be replaced with codegen */
export const globalPrivilegesMap: Record<BasePrivilege, true> = {
  'me:read': true,
  'ownership:read': true,
  'ownership:update': true,
  'ownership:delete': true,
  'ownership:create': true,
  'ods:read': true,
  'ods:read-row-counts': true,
  'edorg:read': true,
  'sb-environment.edfi-tenant:read': true,
  'sb-environment.edfi-tenant:update': true,
  'sb-environment.edfi-tenant:delete': true,
  'sb-environment.edfi-tenant:create': true,
  'sb-environment.edfi-tenant:refresh-resources': true,
  'sb-environment:read': true,
  'sb-environment:update': true,
  'sb-environment:delete': true,
  'sb-environment:create': true,
  'sb-environment:refresh-resources': true,
  'sb-sync-queue:read': true,
  'sb-sync-queue:archive': true,
  'user:read': true,
  'user:update': true,
  'user:delete': true,
  'user:create': true,
  'role:read': true,
  'role:update': true,
  'role:delete': true,
  'role:create': true,
  'team:read': true,
  'team:update': true,
  'team:delete': true,
  'team:create': true,
  'user-team-membership:read': true,
  'user-team-membership:update': true,
  'user-team-membership:delete': true,
  'user-team-membership:create': true,
  ...integrationProviderPrivileges,
};
/** @deprecated to be replaced with codegen */
export const isGlobalPrivilege = (privilege: PrivilegeCode): privilege is BasePrivilege =>
  privilege in globalPrivilegesMap;

/**
 * Structure of the team resource ownership cache. Each privilege is mapped
 * to the set of all IDs of that resource which are valid for use with that privilege.
 *
 * __IMPORTANT: Applications use the ID of their Edorg, rather than their own ID.__
 * This means filtering must be done after retrieval (which is necessary anyway,
 * which is why we do it like this). By virtue of our particular business logic,
 * vendors and claimsets are either `true` or nothing. Together, these
 * make it possible to entirely avoid having to query the Admin API during cache
 * building.
 */
export interface ITeamCache
  extends Partial<
    Record<TeamBasePrivilege, Ids> & Record<TeamEdfiTenantPrivilege, Record<IEdfiTenant['id'], Ids>>
  > {
  'team.ownership:read'?: Ids;
  'team.role:read'?: Ids;
  'team.role:update'?: Ids;
  'team.role:delete'?: Ids;
  'team.role:create'?: TrueValue;
  'team.user:read'?: Ids;
  'team.user-team-membership:read'?: Ids;
  'team.user-team-membership:update'?: Ids;
  'team.user-team-membership:delete'?: Ids;
  'team.user-team-membership:create'?: TrueValue;
  'team.integration-provider.application:read'?: Ids;
  'team.integration-provider.application:reset-credentials'?: Ids;
  'team.sb-environment:read'?: Ids;
  'team.sb-environment:create-tenant'?: Ids;
  'team.sb-environment:delete-tenant'?: Ids;
  // 'team.sb-environment:refresh-resources'?: Ids;
  'team.sb-environment.edfi-tenant:read'?: Record<ISbEnvironment['id'], Ids>; // these ones are a little unique in being cached per-SbEnv
  // 'team.sb-environment.edfi-tenant:refresh-resources'?: Record<ISbEnvironment['id'], Ids>; // these ones are a little unique in being cached per-SbEnv
  'team.sb-environment.edfi-tenant.vendor:read'?: Record<IEdfiTenant['id'], Ids>;
  'team.sb-environment.edfi-tenant.vendor:update'?: Record<IEdfiTenant['id'], Ids>;
  'team.sb-environment.edfi-tenant.vendor:delete'?: Record<IEdfiTenant['id'], Ids>;
  'team.sb-environment.edfi-tenant.vendor:create'?: Record<IEdfiTenant['id'], TrueValue>;
  'team.sb-environment.edfi-tenant.claimset:read'?: Record<IEdfiTenant['id'], Ids>;
  'team.sb-environment.edfi-tenant.claimset:update'?: Record<IEdfiTenant['id'], Ids>;
  'team.sb-environment.edfi-tenant.claimset:delete'?: Record<IEdfiTenant['id'], Ids>;
  'team.sb-environment.edfi-tenant.claimset:create'?: Record<IEdfiTenant['id'], TrueValue>;
  'team.sb-environment.edfi-tenant.profile:read'?: Record<IEdfiTenant['id'], Ids>;
  'team.sb-environment.edfi-tenant.profile:update'?: Record<IEdfiTenant['id'], Ids>;
  'team.sb-environment.edfi-tenant.profile:delete'?: Record<IEdfiTenant['id'], Ids>;
  'team.sb-environment.edfi-tenant.profile:create'?: Record<IEdfiTenant['id'], TrueValue>;
  'team.sb-environment.edfi-tenant.ods:read'?: Record<IEdfiTenant['id'], Ids>;
  'team.sb-environment.edfi-tenant.ods:read-row-counts'?: Record<IEdfiTenant['id'], Ids>;
  'team.sb-environment.edfi-tenant.ods.edorg:read'?: Record<IEdfiTenant['id'], Ids>;
  'team.sb-environment.edfi-tenant.ods.edorg.application:read'?: Record<IEdfiTenant['id'], Ids>;
  'team.sb-environment.edfi-tenant.ods.edorg.application:update'?: Record<IEdfiTenant['id'], Ids>;
  'team.sb-environment.edfi-tenant.ods.edorg.application:delete'?: Record<IEdfiTenant['id'], Ids>;
  'team.sb-environment.edfi-tenant.ods.edorg.application:create'?: Record<
    IEdfiTenant['id'],
    TrueValue
  >;
  'team.sb-environment.edfi-tenant.ods.edorg.application:reset-credentials'?: Record<
    IEdfiTenant['id'],
    Ids
  >;
}

export const trueOnlyPrivileges = new Set<
  TeamBasePrivilege | TeamEdfiTenantPrivilege | TeamSbEnvironmentPrivilege
>([
  'team.role:create',
  'team.sb-environment.edfi-tenant.claimset:create',
  'team.sb-environment.edfi-tenant.vendor:create',
]);
export const isBaseTeamPrivilege = (str: string): str is TeamBasePrivilege =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new Set(Object.values(baseTeamResourcePrivilegesMap).flat()).has(str as any);
// TODO eventually this can be a dynamic version of the above: /^team\.[a-z-]+:/.test(str);
/** @deprecated to be replaced with codegen */
export const baseTeamResourcePrivilegesMap: Record<string, TeamBasePrivilege[]> = {
  'team.integration-provider.application': [
    'team.integration-provider.application:read',
    'team.integration-provider.application:reset-credentials',
  ],
  'team.user': ['team.user:read'],
  'team.user-team-membership': [
    'team.user-team-membership:read',
    'team.user-team-membership:update',
    'team.user-team-membership:delete',
    'team.user-team-membership:create',
  ],
  'team.role': ['team.role:read', 'team.role:update', 'team.role:delete', 'team.role:create'],
  'team.ownership': ['team.ownership:read'],
  'team.sb-environment': [
    'team.sb-environment:read',
    'team.sb-environment:create-tenant',
    'team.sb-environment:delete-tenant',
  ],
};
/** @deprecated to be replaced with codegen */
export const sbEnvironmentResourcePrivilegesMap: Partial<
  Record<string, TeamSbEnvironmentPrivilege[]>
> = {
  'team.sb-environment.edfi-tenant': ['team.sb-environment.edfi-tenant:read'],
};

/** @deprecated to be replaced with codegen */
export const edfiTenantResourcePrivilegesMap: Partial<Record<string, TeamEdfiTenantPrivilege[]>> = {
  'team.sb-environment.edfi-tenant': [
    'team.sb-environment.edfi-tenant:create-ods',
    'team.sb-environment.edfi-tenant:delete-ods',
  ],
  'team.sb-environment.edfi-tenant.vendor': [
    'team.sb-environment.edfi-tenant.vendor:read',
    'team.sb-environment.edfi-tenant.vendor:update',
    'team.sb-environment.edfi-tenant.vendor:delete',
    'team.sb-environment.edfi-tenant.vendor:create',
  ],
  'team.sb-environment.edfi-tenant.claimset': [
    'team.sb-environment.edfi-tenant.claimset:read',
    'team.sb-environment.edfi-tenant.claimset:update',
    'team.sb-environment.edfi-tenant.claimset:delete',
    'team.sb-environment.edfi-tenant.claimset:create',
  ],
  'team.sb-environment.edfi-tenant.profile': [
    'team.sb-environment.edfi-tenant.profile:read',
    'team.sb-environment.edfi-tenant.profile:update',
    'team.sb-environment.edfi-tenant.profile:delete',
    'team.sb-environment.edfi-tenant.profile:create',
  ],
  'team.sb-environment.edfi-tenant.ods': [
    'team.sb-environment.edfi-tenant.ods:read',
    'team.sb-environment.edfi-tenant.ods:read-row-counts',
    'team.sb-environment.edfi-tenant.ods:create-edorg',
    'team.sb-environment.edfi-tenant.ods:delete-edorg',
  ],
  'team.sb-environment.edfi-tenant.ods.edorg': ['team.sb-environment.edfi-tenant.ods.edorg:read'],
  'team.sb-environment.edfi-tenant.ods.edorg.application': [
    'team.sb-environment.edfi-tenant.ods.edorg.application:read',
    'team.sb-environment.edfi-tenant.ods.edorg.application:update',
    'team.sb-environment.edfi-tenant.ods.edorg.application:delete',
    'team.sb-environment.edfi-tenant.ods.edorg.application:create',
    'team.sb-environment.edfi-tenant.ods.edorg.application:reset-credentials',
    'team.sb-environment.edfi-tenant.vendor:read',
    'team.sb-environment.edfi-tenant.profile:read',
    'team.sb-environment.edfi-tenant.claimset:read',
  ],
};

/** @deprecated to be replaced with codegen */
export type BasePrivilegeResourceType = keyof typeof baseTeamResourcePrivilegesMap;
/** @deprecated to be replaced with codegen */
export type EdfiTenantPrivilegeResourceType = keyof typeof edfiTenantResourcePrivilegesMap;
/** @deprecated to be replaced with codegen */
export type PrivilegeResource = BasePrivilegeResourceType | EdfiTenantPrivilegeResourceType;

/** Privileges that are cached in a Dict keyed by edfiTenantId */
export const isCachedByEdfiTenant = (str: string): str is TeamEdfiTenantPrivilege =>
  str.startsWith('team.sb-environment.edfi-tenant') && !isCachedBySbEnvironment(str);

/** Privileges that are cached in a Dict keyed by sbEnvironmentId */
export const isCachedBySbEnvironment = (str: string): str is TeamSbEnvironmentPrivilege =>
  str === 'team.sb-environment.edfi-tenant:read';
