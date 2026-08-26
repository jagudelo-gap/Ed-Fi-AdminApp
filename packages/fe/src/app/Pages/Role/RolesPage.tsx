import { useQuery } from '@tanstack/react-query';
import { HStack } from '@chakra-ui/react';
import {
  SbaaTableAllInOne,
  PageTemplate,
  TableRowActions,
  ValueAsDate,
} from '@edanalytics/common-ui';
import { GetRoleDto, RoleType } from '@edanalytics/models';
import { CellContext } from '@tanstack/react-table';
import { useParams } from 'react-router';
import { roleQueries, useMyTeams, userQueries } from '../../api';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { RoleLink, UserLink } from '../../routes';
import { useRoleActions } from './useRoleActions';
import { useAuthorize } from '../../helpers';

const NameCell = (info: CellContext<GetRoleDto, unknown>) => {
  const params = useParams() as { asId: string };
  const entities = useQuery(
    roleQueries.getAll({
      teamId: params.asId,
    })
  );
  const actions = useRoleActions(info.row.original);
  return (
    <HStack justify="space-between">
      <RoleLink id={info.row.original.id} query={entities} />
      <TableRowActions actions={actions} />
    </HStack>
  );
};

export const RolesPage = () => {
  const params = useParams();
  const teamId = Number(params.asId);
  const roles = useQuery(
    roleQueries.getAll({
      teamId: params.asId,
    })
  );
  const users = useQuery({
    ...userQueries.getAll({ teamId: params.asId }),
    enabled: useAuthorize({ privilege: 'team.user:read', subject: { teamId, id: '__filtered__' } }),
  });
  const teams = useMyTeams();

  return (
    <PageTemplate title="Roles" justifyActionsLeft>
      <SbaaTableAllInOne
        data={Object.values(roles?.data || {})}
        columns={[
          {
            accessorKey: 'displayName',
            cell: NameCell,
            header: 'Name',
          },
          {
            id: 'type',
            accessorFn: (info) => RoleType[info.type],
            header: 'Type',
            filterFn: 'equalsString',
            meta: {
              type: 'options',
            },
          },
          {
            id: 'owned-by',
            accessorFn: (info) =>
              typeof info.teamId === 'number'
                ? getRelationDisplayName(info.teamId, teams)
                : 'Public',
            header: 'Owned by',
            filterFn: 'equalsString',
            meta: {
              type: 'options',
            },
          },
          {
            id: 'modifiedBy',
            accessorFn: (info) => getRelationDisplayName(info.modifiedById, users),
            header: 'Modified by',
            cell: (info) => <UserLink id={info.row.original.modifiedById} />,
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
          {
            id: 'createdBy',
            accessorFn: (info) => getRelationDisplayName(info.createdById, users),
            header: 'Created by',
            cell: (info) => <UserLink id={info.row.original.createdById} />,
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
