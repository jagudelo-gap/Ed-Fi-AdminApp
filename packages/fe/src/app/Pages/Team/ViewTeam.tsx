import { useQuery } from '@tanstack/react-query';
import {
  Attribute,
  AttributesGrid,
  ContentSection,
  SbaaTableAllInOne,
  ValueAsDate,
} from '@edanalytics/common-ui';
import { GetTeamDto } from '@edanalytics/models';
import { useParams } from 'react-router';
import {
  ownershipQueries,
  roleQueries,
  teamQueries,
  userQueries,
  userTeamMembershipQueries,
} from '../../api';
import { getRelationDisplayName } from '../../helpers';
import { UserGlobalLink } from '../../routes';
import { RoleGlobalLink } from '../../routes/role-global.routes';
import { OwnershipsNameCell } from '../OwnershipGlobal/OwnershipsNameCell';
import { UtmGlobalNameCell } from '../UserTeamMembershipGlobal/UtmGlobalNameCell';

export const ViewTeam = () => {
  const params = useParams() as { teamId: string };
  const team = useQuery(
    teamQueries.getOne({
      id: params.teamId,
    })
  ).data;

  return team ? (
    <ContentSection>
      <AttributesGrid>
        <Attribute label="Name" value={team.name} />
      </AttributesGrid>
    </ContentSection>
  ) : null;
};

export const TeamOwnershipsTable = (props: { team: GetTeamDto }) => {
  const ownerships = useQuery(ownershipQueries.getAll({}));
  const roles = useQuery(roleQueries.getAll({}));

  return (
    <ContentSection heading="Ownerships">
      <SbaaTableAllInOne
        queryKeyPrefix="own"
        data={Object.values(ownerships?.data || {}).filter((o) => o.teamId === props.team.id)}
        isFixedHeightForPagination
        columns={[
          {
            accessorKey: 'displayName',
            cell: OwnershipsNameCell,
            header: 'Name',
          },
          {
            id: 'role',
            accessorFn: (info) => getRelationDisplayName(info.roleId, roles),
            header: 'Role',
            cell: (info) => <RoleGlobalLink id={info.row.original.roleId} query={roles} />,
            filterFn: 'equalsString',
            meta: {
              type: 'options',
            },
          },
          {
            accessorKey: 'resourceText',
            header: 'Resource',
          },
        ]}
      />
    </ContentSection>
  );
};

export const TeamMembershipsTable = (props: { team: GetTeamDto }) => {
  const roles = useQuery(roleQueries.getAll({}));
  const userTeamMemberships = useQuery(userTeamMembershipQueries.getAll({}));
  const users = useQuery(userQueries.getAll({}));

  return (
    <ContentSection heading="User memberships">
      <SbaaTableAllInOne
        queryKeyPrefix="utm"
        data={Object.values(userTeamMemberships?.data || {}).filter(
          (m) => m.teamId === props.team.id
        )}
        columns={[
          {
            accessorKey: 'displayName',
            cell: UtmGlobalNameCell,
            header: '',
            enableSorting: false,
          },
          {
            id: 'user',
            accessorFn: (info) => getRelationDisplayName(info.userId, users),
            header: 'User',
            cell: (info) => <UserGlobalLink id={info.row.original.userId} />,
            filterFn: 'equalsString',
            meta: {
              type: 'options',
            },
          },
          {
            id: 'role',
            accessorFn: (info) => getRelationDisplayName(info.roleId, roles),
            header: 'Role',
            cell: (info) => <RoleGlobalLink id={info.row.original.roleId} query={roles} />,
            filterFn: 'equalsString',
            meta: {
              type: 'options',
            },
          },
          {
            id: 'createdDetailed',
            accessorKey: 'createdNumber',
            cell: ValueAsDate(),
            header: 'Created',
            meta: {
              type: 'date',
            },
          },
        ]}
      />
    </ContentSection>
  );
};
