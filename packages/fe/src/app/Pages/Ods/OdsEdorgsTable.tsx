import { SbaaTableAllInOne } from '@edanalytics/common-ui';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useParams } from 'react-router';
import { edorgQueries, odsQueries } from '../../api';
import {
  getRelationDisplayName,
  useAuthorize,
  useTeamEdfiTenantNavContextLoaded,
} from '../../helpers';
import { EdorgLink } from '../../routes';
import { NameCell } from '../Edorg/NameCell';

export const OdsEdorgsTable = () => {
  const params = useParams() as {
    odsId: string;
  };
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const ods = useQuery(
    odsQueries.getOne({
      id: params.odsId,
      edfiTenant,
      teamId,
    })
  ).data;
  const edorgs = useQuery({
    ...edorgQueries.getAll({
      edfiTenant,
      teamId,
    }),
    enabled: useAuthorize({
      privilege: 'team.sb-environment.edfi-tenant.ods.edorg:read',
      subject: {
        id: '__filtered__',
        edfiTenantId: edfiTenant.id,
        teamId,
      },
    }),
  });

  const filteredEdorgs = useMemo(
    () => Object.values(edorgs?.data || {}).filter((edorg) => edorg.odsId === Number(params.odsId)),
    [params, edorgs]
  );

  return ods ? (
    <SbaaTableAllInOne
      queryKeyPrefix={`edorg`}
      data={filteredEdorgs}
      columns={[
        {
          accessorKey: 'displayName',
          cell: NameCell,
          header: 'Name',
        },
        {
          id: 'parent',
          accessorFn: (info) => getRelationDisplayName(info.parentId, edorgs),
          header: 'Parent Ed-Org',
          cell: (info) => <EdorgLink query={edorgs} id={info.row.original.parentId} />,
        },
        {
          id: 'discriminator',
          accessorFn: (info) => info.discriminator,
          header: 'Type',
        },
      ]}
    />
  ) : null;
};
