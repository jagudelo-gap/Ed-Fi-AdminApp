import { PageTemplate, SbaaTableAllInOne } from '@edanalytics/common-ui';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { ownershipQueries, roleQueries, userQueries } from '../../api';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { RoleLink } from '../../routes';

export const OwnershipsPage = () => {
  const params = useParams() as { asId: string };
  const ownerships = useQuery(
    ownershipQueries.getAll({
      teamId: params.asId,
    })
  );
  useQuery(userQueries.getAll({ teamId: params.asId }));
  const roles = useQuery(roleQueries.getAll({ teamId: params.asId }));
  return (
    <PageTemplate title="Ownerships">
      <SbaaTableAllInOne
        data={Object.values(ownerships?.data || {})}
        columns={[
          {
            id: 'role',
            accessorFn: (info) => getRelationDisplayName(info.roleId, roles),
            header: 'Role',
            cell: (info) => <RoleLink query={roles} id={info.row.original.roleId} />,
          },
          {
            accessorKey: 'resourceText',
            header: 'Resource',
          },
        ]}
      />
    </PageTemplate>
  );
};
