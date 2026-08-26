import { Checkbox, Text } from '@chakra-ui/react';
import { EdorgType, EdorgTypeShort, RoleType, edorgCategories } from '@edanalytics/models';
import { enumValues } from '@edanalytics/utils';
import { UseQueryOptions, useQuery } from '@tanstack/react-query';
import uniq from 'lodash/uniq';
import { useMemo, useState } from 'react';
import {
  applicationQueriesV1,
  applicationQueriesV2,
  claimsetQueriesV1,
  edfiTenantQueries,
  edfiTenantQueriesGlobal,
  edorgQueries,
  odsQueries,
  odsTemplateQueries,
  profileQueriesV2,
  roleQueries,
  sbEnvironmentQueries,
  teamQueries,
  userQueries,
  vendorQueriesV1,
  vendorQueriesV2,
} from '../api';
import { ClaimsetEntity, useClaimsetConfig } from '../Pages/ClaimsetV2Plus/claimsetConfig';
import { SelectWrapper, StandardSelector } from './StandardSelector';
import {
  useEdfiTenantNavContextLoaded,
  useNavContext,
  useSbEnvironmentNavContext,
  useTeamEdfiTenantNavContextLoaded,
  useTeamSbEnvironmentNavContext,
} from './navContext';

export const SelectRole: StandardSelector<{ types: RoleType[] }> = (props) => {
  const { types, options: externalOptions, ...others } = props;
  const { teamId } = useNavContext();
  const roles = useQuery(roleQueries.getAll({ teamId }));
  const options =
    externalOptions ??
    Object.fromEntries(
      Object.values(roles.data ?? {})
        .filter((role) => types.includes(role.type))
        .map((role) => [
          role.id,
          {
            value: role.id,
            label: role.displayName,
          },
        ])
    );
  return (
    <SelectWrapper {...others} options={options} isLoading={roles.isPending || roles.isStale} />
  );
};

export const SelectClaimset: StandardSelector<{
  useName?: boolean | undefined;
  noReserved?: boolean | undefined;
}> = (props) => {
  const { options: externalOptions, ...others } = props;
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const claimsets = useQuery(claimsetQueriesV1.getAll({ teamId, edfiTenant }));
  const claimsetsArr = props.noReserved
    ? Object.values(claimsets.data ?? {}).filter((claimset) => !claimset.isSystemReserved)
    : Object.values(claimsets.data ?? {});
  const options =
    externalOptions ??
    Object.fromEntries(
      claimsetsArr.map((claimset) => [
        props.useName ? claimset.name : claimset.id,
        {
          value: props.useName ? claimset.name : claimset.id,
          label: claimset.displayName,
        },
      ])
    );
  return (
    <SelectWrapper
      {...others}
      options={options}
      isLoading={claimsets.isPending || claimsets.isStale}
    />
  );
};

export const SelectClaimsetV2: StandardSelector<{
  useName?: boolean | undefined;
  noReserved?: boolean | undefined;
}> = (props) => {
  const { options: externalOptions, ...others } = props;
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const { queries: claimsetQueries } = useClaimsetConfig();
  // TypeScript cannot resolve union-typed overloaded functions; cast to the
  // actual return type (same pattern as ClaimsetsPage.tsx / ClaimsetPage.tsx).
  const claimsets = useQuery(
    claimsetQueries.getAll({ teamId, edfiTenant }) as UseQueryOptions<
      Record<string | number, ClaimsetEntity>
    >
  );
  const claimsetsArr = props.noReserved
    ? Object.values(claimsets.data ?? {}).filter((claimset) => !claimset._isSystemReserved)
    : Object.values(claimsets.data ?? {});
  const options =
    externalOptions ??
    Object.fromEntries(
      claimsetsArr.map((claimset) => [
        props.useName ? claimset.name : claimset.id,
        {
          value: props.useName ? claimset.name : claimset.id,
          label: claimset.displayName,
        },
      ])
    );

  return (
    <SelectWrapper
      {...others}
      options={options}
      isLoading={claimsets.isPending || claimsets.isStale}
    />
  );
};

export const SelectSbEnvironment: StandardSelector = (props) => {
  const { options: externalOptions, ...others } = props;
  const { teamId } = useNavContext();
  const sbEnvironments = useQuery(sbEnvironmentQueries.getAll({ teamId }));
  const options =
    externalOptions ??
    Object.fromEntries(
      Object.values(sbEnvironments.data ?? {}).map((sbEnvironment) => [
        sbEnvironment.id,
        {
          value: sbEnvironment.id,
          label: sbEnvironment.displayName,
        },
      ])
    );
  return (
    <SelectWrapper
      {...others}
      options={options}
      isLoading={sbEnvironments.isPending || sbEnvironments.isStale}
    />
  );
};
export const SelectEdfiTenant: StandardSelector = (props) => {
  const { options: externalOptions, ...others } = props;
  const { teamId, sbEnvironmentId } = useSbEnvironmentNavContext();
  const edfiTenants = useQuery(
    teamId === undefined
      ? edfiTenantQueriesGlobal.getAll({ sbEnvironmentId })
      : edfiTenantQueries.getAll({ teamId, sbEnvironmentId })
  );
  const options =
    externalOptions ??
    Object.fromEntries(
      Object.values(edfiTenants.data ?? {}).map((edfiTenant) => [
        edfiTenant.id,
        {
          value: edfiTenant.id,
          label: edfiTenant.displayName,
        },
      ])
    );
  return (
    <SelectWrapper
      {...others}
      options={options}
      isLoading={edfiTenants.isPending || edfiTenants.isStale}
    />
  );
};
export const SelectOdsTemplate: StandardSelector = (props) => {
  const { options: externalOptions, ...others } = props;
  const { teamId, sbEnvironmentId } = useTeamSbEnvironmentNavContext();
  const templates = useQuery(odsTemplateQueries.getAll({ sbEnvironmentId, teamId }));
  const options =
    externalOptions ??
    Object.fromEntries(
      Object.values(templates.data ?? {}).map((template) => [
        template.id,
        {
          value: template.id,
          label: template.displayName,
        },
      ])
    );
  return (
    <SelectWrapper
      {...others}
      options={options}
      isLoading={templates.isPending || templates.isStale}
    />
  );
};
export const SelectTeam: StandardSelector = (props) => {
  const { options: externalOptions, ...others } = props;
  const teams = useQuery(teamQueries.getAll({}));
  const options =
    externalOptions ??
    Object.fromEntries(
      Object.values(teams.data ?? {}).map((team) => [
        team.id,
        {
          value: team.id,
          label: team.displayName,
        },
      ])
    );
  return (
    <SelectWrapper {...others} options={options} isLoading={teams.isPending || teams.isStale} />
  );
};
export const SelectUser: StandardSelector = (props) => {
  const { options: externalOptions, ...others } = props;
  const { teamId } = useNavContext();
  const users = useQuery(userQueries.getAll({ teamId }));
  const options =
    externalOptions ??
    Object.fromEntries(
      Object.values(users.data ?? {}).map((user) => [
        user.id,
        {
          value: user.id,
          label: user.displayName + ' (' + user.username + ')',
        },
      ])
    );
  return (
    <SelectWrapper {...others} options={options} isLoading={users.isPending || users.isStale} />
  );
};

export const SelectVendor: StandardSelector = (props) => {
  const { options: externalOptions, ...others } = props;
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const vendors = useQuery(vendorQueriesV1.getAll({ teamId, edfiTenant }));
  const options =
    externalOptions ??
    Object.fromEntries(
      Object.values(vendors.data ?? {}).map((vendor) => [
        vendor.id,
        {
          value: vendor.id,
          label: vendor.displayName,
        },
      ])
    );
  return (
    <SelectWrapper {...others} options={options} isLoading={vendors.isPending || vendors.isStale} />
  );
};
export const SelectVendorV2: StandardSelector = (props) => {
  const { options: externalOptions, ...others } = props;
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const vendors = useQuery(vendorQueriesV2.getAll({ teamId, edfiTenant }));
  const options =
    externalOptions ??
    Object.fromEntries(
      Object.values(vendors.data ?? {}).map((vendor) => [
        vendor.id,
        {
          value: vendor.id,
          label: vendor.displayName,
        },
      ])
    );
  return (
    <SelectWrapper {...others} options={options} isLoading={vendors.isPending || vendors.isStale} />
  );
};

export const SelectProfile: StandardSelector = (props) => {
  const { options: externalOptions, ...others } = props;
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const profiles = useQuery(profileQueriesV2.getAll({ teamId, edfiTenant }));
  const options =
    externalOptions ??
    Object.fromEntries(
      Object.values(profiles.data ?? {}).map((profile) => [
        profile.id,
        {
          value: profile.id,
          label: profile.name,
        },
      ])
    );
  return (
    <SelectWrapper
      {...others}
      options={options}
      isLoading={profiles.isPending || profiles.isStale}
    />
  );
};

export const SelectApplication: StandardSelector = (props) => {
  const { options: externalOptions, ...others } = props;
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const applications = useQuery(applicationQueriesV1.getAll({ teamId, edfiTenant }));
  const options =
    externalOptions ??
    Object.fromEntries(
      Object.values(applications.data ?? {}).map((application) => [
        application.id,
        {
          value: application.id,
          label: application.displayName,
        },
      ])
    );
  return (
    <SelectWrapper
      {...others}
      options={options}
      isLoading={applications.isPending || applications.isStale}
    />
  );
};

export const SelectApplicationV2: StandardSelector = (props) => {
  const { options: externalOptions, ...others } = props;
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const applications = useQuery(applicationQueriesV2.getAll({ teamId, edfiTenant }));
  const options =
    externalOptions ??
    Object.fromEntries(
      Object.values(applications.data ?? {}).map((application) => [
        application.id,
        {
          value: application.id,
          label: application.displayName,
        },
      ])
    );
  return (
    <SelectWrapper
      {...others}
      options={options}
      isLoading={applications.isPending || applications.isStale}
    />
  );
};

export const SelectOds: StandardSelector<{
  useDbName?: boolean;
  useInstanceId?: boolean;
  useInstanceName?: boolean;
}> = (props) => {
  const { useDbName, useInstanceId, useInstanceName, options: externalOptions, ...others } = props;
  const { teamId, edfiTenant } = useEdfiTenantNavContextLoaded();
  const odss = useQuery(odsQueries.getAll({ teamId, edfiTenant }));
  const options =
    externalOptions ??
    Object.fromEntries(
      Object.values(odss.data ?? {}).map((ods) => [
        useDbName
          ? ods.dbName
          : useInstanceId
          ? ods.odsInstanceId
          : useInstanceName
          ? ods.odsInstanceName
          : ods.id,
        {
          value: useDbName
            ? ods.dbName
            : useInstanceId
            ? ods.odsInstanceId
            : useInstanceName
            ? ods.odsInstanceName
            : ods.id,
          label: ods.displayName,
        },
      ])
    );
  return <SelectWrapper {...others} options={options} isLoading={odss.isPending || odss.isStale} />;
};

export const SelectEdorgCategory: StandardSelector = (props) => {
  const { options: _externalOptions, ...others } = props;
  const options = Object.fromEntries(
    edorgCategories.map((catName) => [catName, { label: catName, value: catName }])
  );
  return <SelectWrapper {...others} options={options} />;
};

export const SelectEdorg: StandardSelector<{ useEdorgId?: boolean }, true> = (props) => {
  const { useEdorgId, options: externalOptions, ...others } = props;
  const { teamId, edfiTenant } = useEdfiTenantNavContextLoaded();
  const edorgs = useQuery(edorgQueries.getAll({ teamId, edfiTenant }));
  const discriminators = useMemo(
    () => uniq(Object.values(edorgs.data ?? {}).map((edorg) => edorg.discriminator)),
    [edorgs]
  );
  const [include, setInclude] = useState<string[]>(enumValues(EdorgType));
  const options = useMemo(
    () =>
      Object.fromEntries(
        (externalOptions
          ? Object.entries(externalOptions)
          : Object.values(edorgs.data ?? {}).map((edorg) => [
              useEdorgId ? edorg.educationOrganizationId : edorg.id,
              {
                value: useEdorgId ? edorg.educationOrganizationId : edorg.id,
                label: edorg.displayName,
                subLabel: `${edorg.educationOrganizationId} ${edorg.discriminatorShort}`,
                discriminator: edorg.discriminator,
              },
            ])
        )
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter(([_key, value]) => include.includes((value as any).discriminator))
      ),
    [edorgs, externalOptions, include, useEdorgId]
  );
  const filterApplied = useMemo(
    () => !discriminators.every((d) => include.includes(d)),
    [discriminators, include]
  );
  return (
    <SelectWrapper
      {...others}
      options={options}
      isLoading={edorgs.isPending || edorgs.isStale}
      filterApplied={filterApplied}
      onFilterDoubleClick={() => setInclude(enumValues(EdorgType))}
      filterPane={
        discriminators.length ? (
          discriminators.map((d) => (
            <Checkbox
              key={d}
              isChecked={include.includes(d)}
              onChange={() =>
                setInclude((old): string[] =>
                  old.includes(d) ? old.filter((di) => di !== d) : [...old, d]
                )
              }
            >
              {EdorgTypeShort[d]}
            </Checkbox>
          ))
        ) : (
          <Text as="i" color="gray.400">
            (No Ed-Org types available)
          </Text>
        )
      }
    />
  );
};
