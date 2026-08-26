import { useQuery } from '@tanstack/react-query';
import { HStack } from '@chakra-ui/react';
import {
  SbaaTableAllInOne,
  PageTemplate,
  TableRowActions,
  ValueAsDate,
} from '@edanalytics/common-ui';

import { GetUserTeamMembershipDto } from '@edanalytics/models';
import { CellContext } from '@tanstack/react-table';
import { useParams } from 'react-router';
import { roleQueries, userQueries, userTeamMembershipQueries } from '../../../api';
import { getEntityFromQuery } from '../../../helpers';
import { getRelationDisplayName } from '../../../helpers/getRelationDisplayName';
import { useReadTeamEntity } from '../../../helpers/useStandardRowActionsNew';
import { UserLink, userRoute } from '../../../routes';

const NameCell = (info: CellContext<GetUserTeamMembershipDto, unknown>) => {
  const params = useParams() as { asId: string };
  const users = useQuery(
    userQueries.getAll({
      teamId: params.asId,
    })
  );

  const View = useReadTeamEntity({
    entity: info.row.original,
    params: { ...params, userId: info.row.original.userId },
    privilege: 'team.user:read',
    route: userRoute,
  });
  const actions = {
    ...(View ? { View } : undefined),
  };
  return (
    <HStack justify="space-between">
      <UserLink id={info.row.original.userId} query={users} />
      <TableRowActions actions={actions} />
    </HStack>
  );
};
export const UsersPage = () => {
  const params = useParams() as { asId: string };
  const users = useQuery(
    userQueries.getAll({
      teamId: params.asId,
    })
  );

  const roles = useQuery(roleQueries.getAll({ teamId: params.asId }));

  const userTeamMemberships = useQuery(
    userTeamMembershipQueries.getAll({
      teamId: params.asId,
    })
  );

  return (
    <PageTemplate title="Users">
      <SbaaTableAllInOne
        data={Object.values(userTeamMemberships?.data || {})}
        columns={[
          {
            id: 'displayName',
            accessorFn: (info) => getRelationDisplayName(info.userId, users),
            cell: NameCell,
            header: 'Name',
          },
          {
            id: 'username',
            accessorFn: (info) => getEntityFromQuery(info.userId, users)?.username,
            cell: (info) => getEntityFromQuery(info.row.original.userId, users)?.username,
            header: 'Username',
          },
          {
            id: 'role',
            accessorFn: (info) => getRelationDisplayName(info.roleId, roles),
            cell: (info) => getRelationDisplayName(info.row.original.roleId, roles),
            header: 'Team role',
            filterFn: 'equalsString',
            meta: {
              type: 'options',
            },
          },
          {
            accessorKey: 'createdNumber',
            cell: ValueAsDate(),
            header: 'Created',
            meta: {
              type: 'date',
            },
          },
        ]}
      />
    </PageTemplate>
  );
};
