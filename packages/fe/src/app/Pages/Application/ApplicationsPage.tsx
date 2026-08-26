import {
  CappedLinesText,
  PageActions,
  PageTemplate,
  SbaaTableAllInOne,
} from '@edanalytics/common-ui';
import { GetClaimsetDto, GetEdorgDto, edorgCompositeKey } from '@edanalytics/models';
import {
  applicationQueriesV1,
  claimsetQueriesV1,
  edorgQueries,
  odsQueries,
  vendorQueriesV1,
} from '../../api';

import { useQuery } from '@tanstack/react-query';
import uniq from 'lodash/uniq';
import { getEntityFromQuery, useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { ClaimsetLinkV1, EdorgLink, OdsLink, VendorLinkV1 } from '../../routes';
import { NameCell } from './NameCell';
import { useMultiApplicationActions } from './useApplicationActions';

export const ApplicationsPage = () => {
  return (
    <PageTemplate title="Applications" actions={<ApplicationsPageActions />}>
      <ApplicationsPageContent />
    </PageTemplate>
  );
};

export const ApplicationsPageActions = () => {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const actions = useMultiApplicationActions({
    edfiTenant,
    teamId,
  });
  return <PageActions actions={actions} />;
};

export const ApplicationsPageContent = () => {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const applications = useQuery(
    applicationQueriesV1.getAll({
      edfiTenant,
      teamId,
    })
  );
  const edorgs = useQuery(
    edorgQueries.getAll({
      edfiTenant,
      teamId,
    })
  );
  const edorgsByEdorgId = {
    ...edorgs,
    data: Object.values(edorgs.data ?? {}).reduce<Record<string, GetEdorgDto>>((map, edorg) => {
      map[
        edorgCompositeKey({
          edorg: edorg.educationOrganizationId,
          ods: edorg.odsDbName,
        })
      ] = edorg;
      return map;
    }, {}),
  };
  const odss = useQuery(
    odsQueries.getAll({
      edfiTenant: edfiTenant,
      teamId,
    })
  );
  const vendors = useQuery(
    vendorQueriesV1.getAll({
      edfiTenant,
      teamId,
    })
  );
  const claimsets = useQuery(
    claimsetQueriesV1.getAll({
      edfiTenant,
      teamId,
    })
  );
  const claimsetsByName = {
    ...claimsets,
    data: Object.values(claimsets.data ?? {}).reduce<Record<string, GetClaimsetDto>>(
      (map, claimset) => {
        map[claimset.name] = claimset;
        return map;
      },
      {}
    ),
  };

  return (
    <SbaaTableAllInOne
      data={Object.values(applications?.data || {})}
      columns={[
        {
          accessorKey: 'displayName',
          cell: NameCell,
          header: 'Name',
        },
        {
          id: 'edorg',
          accessorFn: (application) =>
            application._educationOrganizationIds
              .map((edorgId) =>
                getRelationDisplayName(
                  edorgCompositeKey({
                    edorg: edorgId,
                    ods: 'EdFi_Ods_' + application.odsInstanceName,
                  }),
                  edorgsByEdorgId
                )
              )
              .join(', '),
          header: 'Education organization',
          cell: (info) => (
            <CappedLinesText maxLines={2}>
              {info.row.original._educationOrganizationIds
                .map((edorgId) => (
                  <EdorgLink
                    key={edorgId}
                    id={edorgCompositeKey({
                      edorg: edorgId,
                      ods: 'EdFi_Ods_' + info.row.original.odsInstanceName,
                    })}
                    query={edorgsByEdorgId}
                  />
                ))
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .reduce((prev, curr) => [prev, ', ', curr] as any)}
            </CappedLinesText>
          ),
          meta: {
            type: 'options',
          },
        },
        {
          id: 'ods',
          accessorFn: (application) =>
            uniq(
              application._educationOrganizationIds
                .map(
                  (edorgId) =>
                    getEntityFromQuery(
                      edorgCompositeKey({
                        edorg: edorgId,
                        ods: 'EdFi_Ods_' + application.odsInstanceName,
                      }),
                      edorgsByEdorgId
                    )?.odsId
                )
                .filter((odsId) => odsId !== undefined)
            ).join(', '),
          header: 'Ods',
          cell: ({ row: { original: application } }) =>
            uniq(
              application._educationOrganizationIds
                .map(
                  (edorgId) =>
                    getEntityFromQuery(
                      edorgCompositeKey({
                        edorg: edorgId,
                        ods: 'EdFi_Ods_' + application.odsInstanceName,
                      }),
                      edorgsByEdorgId
                    )?.odsId
                )
                .filter((odsId) => odsId !== undefined)
            ).map((odsId) => <OdsLink key={odsId} id={odsId} query={odss} />),
          meta: {
            type: 'options',
          },
        },
        {
          id: 'vendor',
          accessorFn: (info) => getRelationDisplayName(info.vendorId, vendors),
          header: 'Vendor',
          cell: (info) => <VendorLinkV1 query={vendors} id={info.row.original.vendorId} />,
          meta: {
            type: 'options',
          },
        },
        {
          id: 'claimest',
          accessorFn: (info) => getRelationDisplayName(info.claimSetName, claimsetsByName),
          header: 'Claimset',
          cell: (info) => (
            <ClaimsetLinkV1
              query={claimsets}
              id={claimsetsByName.data[info.row.original.claimSetName]?.id}
            />
          ),
          meta: {
            type: 'options',
          },
        },
      ]}
    />
  );
};
