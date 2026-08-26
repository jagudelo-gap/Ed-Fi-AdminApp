import { useQuery } from '@tanstack/react-query';
import { HStack } from '@chakra-ui/react';
import {
  PageActions,
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
import { UserGlobalLink } from '../../routes';
import { RoleGlobalLink } from '../../routes/role-global.routes';
import { useMultipleRoleGlobalActions } from './useMultipleRoleGlobalActions';
import { useRoleGlobalActions } from './useRoleGlobalActions';
import { useAuthorize } from '../../helpers';

const NameCell = (info: CellContext<GetRoleDto, unknown>) => {
  const params = useParams() as { asId: string };
  const entities = useQuery(
    roleQueries.getAll({
      teamId: params.asId,
    })
  );
  const actions = useRoleGlobalActions(info.row.original);
  return (
    <HStack justify="space-between">
      <RoleGlobalLink id={info.row.original.id} query={entities} />
      <TableRowActions actions={actions} />
    </HStack>
  );
};

export const RolesGlobalPage = () => {
  const params = useParams();
  const roles = useQuery(
    roleQueries.getAll({
      teamId: params.asId,
    })
  );
  const users = useQuery({
    ...userQueries.getAll({ teamId: params.asId }),
    enabled: useAuthorize({
      privilege: 'user:read',
      subject: {
        id: '__filtered__',
      },
    }),
  });
  const teams = useMyTeams();
  const actions = useMultipleRoleGlobalActions();
  return (
    <PageTemplate title="Roles" justifyActionsLeft actions={<PageActions actions={actions} />}>
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
            cell: (info) => <UserGlobalLink id={info.row.original.modifiedById} />,
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
            cell: (info) => <UserGlobalLink id={info.row.original.createdById} />,
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
