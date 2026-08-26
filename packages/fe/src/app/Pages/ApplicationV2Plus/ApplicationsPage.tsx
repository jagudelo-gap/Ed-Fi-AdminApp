import { Fragment } from 'react';
import {
  CappedLinesText,
  PageActions,
  PageTemplate,
  SbaaTableAllInOne,
} from '@edanalytics/common-ui';
import { GetEdorgDto, GetOdsDto, edorgKeyV2 } from '@edanalytics/models';
import { edorgQueries, odsQueries, profileQueriesV2, vendorQueriesV2 } from '../../api';

import { UseQueryOptions, useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { ClaimsetLinkV2 } from '../../routes/claimset.routes';
import { EdorgLink } from '../../routes/edorg.routes';
import { OdsLink } from '../../routes/ods.routes';
import { ProfileLink } from '../../routes/profile.routes';
import { VendorLinkV2 } from '../../routes/vendor.routes';
import { NameCell } from './NameCell';
import { useMultiApplicationActions } from './useApplicationActions';
import { useGetManyApplications } from '../../api-v2';
import { ApplicationEntity, getDataStoreIds, useApplicationConfig } from './applicationConfig';
import { ClaimsetEntity, useClaimsetConfig } from '../ClaimsetV2Plus/claimsetConfig';
import { useOdsTerminology } from '../Ods/useOdsTerminology';

export const ApplicationsPageV2 = () => {
  return (
    <PageTemplate title="Applications" actions={<ApplicationsPageActions />}>
      <AllApplicationsTable />
    </PageTemplate>
  );
};

export const ApplicationsPageActions = () => {
  const { edfiTenantId, asId } = useTeamEdfiTenantNavContextLoaded();

  const actions = useMultiApplicationActions({
    edfiTenantId: edfiTenantId,
    teamId: asId,
  });
  return <PageActions actions={actions} />;
};

export const AllApplicationsTable = () => {
  const { asId, edfiTenantId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const { version, queries } = useApplicationConfig();
  const odsTerminology = useOdsTerminology();

  // v2 tenants keep using the hardcoded-v2-URL hook (unchanged); v3 tenants
  // fetch through the versioned query builder instead. Only one of these two
  // is ever actually enabled/used for a given tenant.
  const { data: v2Applications } = useGetManyApplications({
    queryArgs: { edfiTenantId, teamId: asId },
    enabled: version === 'v2',
  });
  // TypeScript cannot resolve union-typed overloaded functions; cast to the
  // actual return type (same pattern as ClaimsetsPage.tsx / ProfilesPage.tsx).
  const v3Applications = useQuery({
    ...(queries.getAll({ edfiTenant, teamId: asId }) as unknown as UseQueryOptions<
      Record<string | number, ApplicationEntity>
    >),
    enabled: version === 'v3',
  });

  const applications: ApplicationEntity[] =
    version === 'v2'
      ? ((v2Applications ?? []) as ApplicationEntity[])
      : Object.values(v3Applications.data ?? {});

  const edorgs = useQuery(edorgQueries.getAll({ edfiTenant, teamId: asId }));
  const odss = useQuery(odsQueries.getAll({ edfiTenant, teamId: asId }));

  const odssByInstanceId = {
    ...odss,
    data: Object.values(odss.data ?? {}).reduce<Record<string, GetOdsDto>>((map, ods) => {
      map[ods.odsInstanceId!] = ods;
      return map;
    }, {}),
  };
  const edorgsByEdorgId = {
    ...edorgs,
    data: Object.values(edorgs.data ?? {}).reduce<Record<string, GetEdorgDto>>((map, edorg) => {
      map[
        edorgKeyV2({
          edorg: edorg.educationOrganizationId,
          ods: edorg.odsInstanceId,
        })
      ] = edorg;
      return map;
    }, {}),
  };
  const vendors = useQuery(
    vendorQueriesV2.getAll({
      teamId: asId,
      edfiTenant: edfiTenant,
    })
  );
  const profiles = useQuery(
    profileQueriesV2.getAll({
      teamId: asId,
      edfiTenant: edfiTenant,
    })
  );

  const { queries: claimsetQueries } = useClaimsetConfig();
  // TypeScript cannot resolve union-typed overloaded functions; cast to the
  // actual return type (same pattern as ClaimsetsPage.tsx / ClaimsetPage.tsx).
  const claimsets = useQuery(
    claimsetQueries.getAll({
      teamId: asId,
      edfiTenant: edfiTenant,
    }) as UseQueryOptions<Record<string | number, ClaimsetEntity>>
  );
  const claimsetsByName = {
    ...claimsets,
    data: Object.values(claimsets.data ?? {}).reduce<Record<string, ClaimsetEntity>>(
      (map, claimset) => {
        map[claimset.name] = claimset;
        return map;
      },
      {}
    ),
  };

  return (
    <SbaaTableAllInOne
      data={applications ?? []}
      columns={[
        {
          accessorKey: 'applicationName',
          cell: NameCell,
          header: 'Name',
        },
        {
          id: 'edorg',
          accessorFn: (application) =>
            application.educationOrganizationIds
              .flatMap((edorgId) =>
                getDataStoreIds(application).map((odsInstanceId) =>
                  getRelationDisplayName(
                    edorgKeyV2({
                      edorg: edorgId,
                      ods: odsInstanceId,
                    }),
                    edorgsByEdorgId
                  )
                )
              )
              .join(', '),
          header: 'Education organization',
          cell: (info) => {
            const { educationOrganizationIds } = info.row.original;
            const odsInstanceIds = getDataStoreIds(info.row.original);
            const addCommas = educationOrganizationIds.length > 1;
            return (
              <CappedLinesText maxLines={2}>
                {educationOrganizationIds.flatMap((edorgId, index) =>
                  odsInstanceIds.map((odsInstanceId) => (
                    <Fragment key={edorgId}>
                      <EdorgLink
                        id={edorgKeyV2({
                          edorg: edorgId,
                          ods: odsInstanceId,
                        })}
                        query={edorgsByEdorgId}
                      />
                      {addCommas && index < educationOrganizationIds.length - 1 ? ', ' : ''}
                    </Fragment>
                  ))
                )}
              </CappedLinesText>
            );
          },
          meta: {
            type: 'options',
          },
        },
        {
          id: 'ods',
          accessorFn: (application) =>
            getDataStoreIds(application)
              .map((odsInstanceId) => getRelationDisplayName(odsInstanceId, odssByInstanceId))
              .join(', '),
          header: odsTerminology.plural,
          cell: (info) => {
            const odsInstanceIds = getDataStoreIds(info.row.original);
            const addCommas = odsInstanceIds.length > 1;
            return (
              <>
                {odsInstanceIds.map((odsInstanceId, index) => (
                  <Fragment key={odsInstanceId}>
                    <OdsLink id={odsInstanceId} query={odssByInstanceId} />
                    {addCommas && index < odsInstanceIds.length - 1 ? ', ' : ''}
                  </Fragment>
                ))}
              </>
            );
          },
          meta: {
            type: 'options',
          },
        },
        {
          id: 'vendor',
          accessorFn: (info) => getRelationDisplayName(info.vendorId, vendors),
          header: 'Vendor',
          cell: (info) => <VendorLinkV2 query={vendors} id={info.row.original.vendorId} />,
          meta: {
            type: 'options',
          },
        },
        {
          id: 'profiles',
          accessorFn: (application) =>
            application.profileIds
              .map((profileId) => getRelationDisplayName(profileId, profiles))
              .join(', '),
          header: 'Profiles',
          cell: (info) => {
            const { profileIds } = info.row.original;
            const addCommas = profileIds.length > 1;
            return (
              <>
                {profileIds.map((profileId, index) => (
                  <Fragment key={profileId}>
                    <ProfileLink query={profiles} id={profileId} />
                    {addCommas && index < profileIds.length - 1 ? ', ' : ''}
                  </Fragment>
                ))}
              </>
            );
          },
        },
        {
          id: 'claimset',
          accessorFn: (info) => getRelationDisplayName(info.claimSetName, claimsetsByName),
          header: 'Claimset',
          cell: (info) => (
            <ClaimsetLinkV2 query={claimsetsByName} id={info.row.original.claimSetName} />
          ),
          meta: {
            type: 'options',
          },
        },
        {
          id: 'integrationProvider',
          header: 'Integration Provider',
          accessorFn: (application) => application.integrationProviderName,
        },
      ] as ColumnDef<ApplicationEntity>[]}
    />
  );
};
