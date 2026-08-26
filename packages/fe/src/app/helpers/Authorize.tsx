import {
  BasePrivilege,
  PrivilegeCode,
  TeamBasePrivilege,
  TeamEdfiTenantPrivilege,
  TeamSbEnvironmentPrivilege,
} from '@edanalytics/models';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { ReactElement } from 'react';
import { FeAuthCache, authCachArraysToSets, usePrivilegeCache } from '../api';

export type AuthorizeConfig<
  PrivilegeType extends
    | BasePrivilege
    | TeamBasePrivilege
    | TeamEdfiTenantPrivilege
    | TeamSbEnvironmentPrivilege = PrivilegeCode
> = {
  privilege: PrivilegeType;
  subject: (PrivilegeType extends BasePrivilege ? object : { teamId: number }) &
    (PrivilegeType extends TeamSbEnvironmentPrivilege ? { sbEnvironmentId: number } : object) &
    (PrivilegeType extends TeamEdfiTenantPrivilege ? { edfiTenantId: number } : object) & {
      id: string | number | '__filtered__';
    };
};

export type AuthorizeParameters<PrivilegeType extends PrivilegeCode, ValueType> = {
  value: ValueType;
  config:
    | undefined
    | AuthorizeConfig<PrivilegeType>
    | (AuthorizeConfig<PrivilegeType> | undefined)[];
};

export const authorize = <PrivilegeType extends PrivilegeCode>(props: {
  queryClient: QueryClient;
  config:
    | undefined
    | AuthorizeConfig<PrivilegeType>
    | (AuthorizeConfig<PrivilegeType> | undefined)[];
}) => {
  const configArray = Array.isArray(props.config)
    ? (props.config.filter((c) => c !== undefined) as AuthorizeConfig<PrivilegeType>[])
    : props.config === undefined
    ? []
    : [props.config];
  let isAuthorized =
    props.config !== undefined && (!Array.isArray(props.config) || props.config.length > 0);
  configArray.forEach((config, _i) => {
    const thisPrivilegeCache = props.queryClient.getQueryData<FeAuthCache>(
      authCacheKey({
        teamId: 'teamId' in config.subject ? config.subject.teamId : undefined,
        sbEnvironmentId:
          'sbEnvironmentId' in config.subject ? config.subject.sbEnvironmentId : undefined,
        edfiTenantId: 'edfiTenantId' in config.subject ? config.subject.edfiTenantId : undefined,
      })
    );
    /**
    This query data gets stored in its native format which allows react-query's diffing to work
    but should be transformed (Array to Set) for more efficient usage.
    */
    const transformedCache =
      thisPrivilegeCache === undefined ? undefined : authCachArraysToSets(thisPrivilegeCache);
    const selectedValue = transformedCache?.[config.privilege] ?? false;
    if (selectedValue === false) {
      isAuthorized = false;
    } else if (selectedValue === true) {
      // no change
    } else if (config.subject.id === '__filtered__') {
      // no change
    } else if (
      selectedValue?.has(config.subject.id) ||
      selectedValue?.has(String(config.subject.id)) ||
      selectedValue?.has(Number(config.subject.id))
    ) {
      // no change
    } else {
      isAuthorized = false;
    }
  });
  return isAuthorized;
};

export type AuthorizeComponentProps<PrivilegeType extends PrivilegeCode> = {
  children?: ReactElement;
  config: undefined | AuthorizeConfig<PrivilegeType> | AuthorizeConfig<PrivilegeType>[];
};

export const usePrivilegeCacheForConfig = <PrivilegeType extends PrivilegeCode>(
  config:
    | undefined
    | AuthorizeConfig<PrivilegeType>
    | (AuthorizeConfig<PrivilegeType> | undefined)[]
) => {
  const configArray = Array.isArray(config)
    ? (config.filter((c) => c !== undefined) as AuthorizeConfig<PrivilegeType>[])
    : config === undefined
    ? []
    : [config];
  return usePrivilegeCache(
    configArray.map((config) => ({
      privilege: config.privilege,
      teamId: 'teamId' in config.subject ? config.subject.teamId : undefined,
      edfiTenantId: 'edfiTenantId' in config.subject ? config.subject.edfiTenantId : undefined,
      sbEnvironmentId:
        'sbEnvironmentId' in config.subject ? config.subject.sbEnvironmentId : undefined,
    }))
  );
};

export const useAuthorize = <PrivilegeType extends PrivilegeCode>(
  config:
    | undefined
    | AuthorizeConfig<PrivilegeType>
    | (AuthorizeConfig<PrivilegeType> | undefined)[]
) => {
  const queryClient = useQueryClient();
  usePrivilegeCacheForConfig(config);
  return authorize({ queryClient, config });
};

export const AuthorizeComponent = <PrivilegeType extends PrivilegeCode>(
  props: AuthorizeComponentProps<PrivilegeType>
) => {
  usePrivilegeCacheForConfig(props.config);
  const queryClient = useQueryClient();

  if (authorize({ queryClient, config: props.config })) {
    return props.children ?? null;
  } else {
    return null;
  }
};

export function authCacheKey(
  config:
    | { teamId?: number | string }
    | { teamId: number | string; edfiTenantId?: number | string; sbEnvironmentId?: number | string }
) {
  return [
    'auth-cache',
    'team:',
    config.teamId !== undefined ? String(config.teamId) : undefined,
    'sb-environment:',
    'sbEnvironmentId' in config && config.sbEnvironmentId !== undefined
      ? String(config.sbEnvironmentId)
      : undefined,
    'edfi-tenant:',
    'edfiTenantId' in config && config.edfiTenantId !== undefined
      ? String(config.edfiTenantId)
      : undefined,
  ];
}
