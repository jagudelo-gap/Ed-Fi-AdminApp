import { PageActions, PageTemplate, SbaaTableAllInOne } from '@edanalytics/common-ui';
import { GetEdorgDto } from '@edanalytics/models';
import { useQuery } from '@tanstack/react-query';
import { CellContext } from '@tanstack/react-table';
import { edorgQueries, odsQueries } from '../../api';
import { queryClient } from '../../app';
import {
  AuthorizeConfig,
  arrayElemIf,
  authorize,
  useTeamEdfiTenantNavContextLoaded,
} from '../../helpers';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { EdorgLink, OdsLink } from '../../routes';
import { NameCell } from './NameCell';
import { useEdorgsActions } from './useEdorgsActions';
import { useSyncEdOrgsAction } from './useSyncEdOrgsAction';

export const EdorgsPage = () => {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const odsAuth: AuthorizeConfig = {
    privilege: 'team.sb-environment.edfi-tenant.ods:read',
    subject: {
      id: '__filtered__',
      edfiTenantId: edfiTenant.id,
      teamId,
    },
  };
  const odss = useQuery({
    ...odsQueries.getAll({
      teamId,
      edfiTenant,
    }),
    enabled: authorize({ config: odsAuth, queryClient }),
  });
  const edorgs = useQuery(
    edorgQueries.getAll({
      teamId,
      edfiTenant,
    })
  );

  const actions = useEdorgsActions({});
  const syncEdOrgsAction = useSyncEdOrgsAction();

  return (
    <PageTemplate
      title="Education Organizations"
      actions={<PageActions actions={{ ...actions, ...syncEdOrgsAction }} />}
    >
      <SbaaTableAllInOne
        data={Object.values(edorgs?.data || {})}
        columns={[
          {
            accessorKey: 'displayName',
            cell: NameCell,
            header: 'Name',
          },
          {
            id: 'shortName',
            accessorFn: (info) => info.shortNameOfInstitution,
            header: 'Short name',
          },
          {
            id: 'parent',
            accessorFn: (info) => getRelationDisplayName(info.parentId, edorgs),
            header: 'Parent Ed-Org',
            cell: (info) => <EdorgLink query={edorgs} id={info.row.original.parentId} />,
            filterFn: 'equalsString',
            meta: {
              type: 'options',
            },
          },
          {
            id: 'educationOrganizationId',
            accessorFn: (info) => String(info.educationOrganizationId),
            header: 'Education Org ID',
            filterFn: 'equalsString',
            meta: {
              type: 'options',
            },
          },
          ...arrayElemIf(authorize({ config: odsAuth, queryClient }), {
            id: 'ods',
            accessorFn: (info: GetEdorgDto) => getRelationDisplayName(info.odsId, odss),
            header: 'ODS',
            cell: (info: CellContext<GetEdorgDto, unknown>) => (
              <OdsLink query={odss} id={info.row.original.odsId} />
            ),
            filterFn: 'equalsString' as const,
            meta: {
              type: 'options',
            },
          }),
          {
            id: 'discriminator',
            accessorFn: (info) => info.discriminator,
            header: 'Type',
            filterFn: 'equalsString',
            meta: {
              type: 'options',
            },
          },
        ]}
      />
    </PageTemplate>
  );
};
