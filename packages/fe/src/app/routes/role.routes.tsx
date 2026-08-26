import { Link, Text } from '@chakra-ui/react';
import { GetRoleDto } from '@edanalytics/models';
import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { RouteObject, Link as RouterLink, useParams } from 'react-router';
import { RolePage } from '../Pages/Role/RolePage';
import { RolesPage } from '../Pages/Role/RolesPage';
import { roleQueries } from '../api';
import { getRelationDisplayName, useNavContext } from '../helpers';
import { getEntityFromQuery } from '../helpers/getEntityFromQuery';

const RoleBreadcrumb = () => {
  const params = useParams() as { roleId: string; asId: string };
  const role = useQuery(
    roleQueries.getOne({
      id: params.roleId,
      teamId: params.asId,
    })
  );
  return role.data?.displayName ?? params.roleId;
};

export const roleIndexRoute: RouteObject = {
  path: '/as/:asId/roles/:roleId/',
  element: <RolePage />,
};
export const roleRoute: RouteObject = {
  path: '/as/:asId/roles/:roleId',
  handle: { crumb: RoleBreadcrumb },
};
export const rolesIndexRoute: RouteObject = {
  path: '/as/:asId/roles/',
  element: <RolesPage />,
};
export const rolesRoute: RouteObject = {
  path: '/as/:asId/roles',
  handle: { crumb: () => 'Roles' },
};

export const RoleLink = (props: {
  id: number | undefined | null;
  query: UseQueryResult<Record<string | number, GetRoleDto>, unknown>;
}) => {
  const role = getEntityFromQuery(props.id, props.query);
  const navContext = useNavContext();
  const asId = navContext.asId!;

  return role ? (
    <Link as="span">
      <RouterLink title="Go to role" to={`/as/${asId}/roles/${role.id}`}>
        {getRelationDisplayName(props.id, props.query)}
      </RouterLink>
    </Link>
  ) : typeof props.id === 'number' ? (
    <Text title="Role may have been deleted, or you lack access." as="i" color="gray.500">
      can't find &#8220;{props.id}&#8221;
    </Text>
  ) : null;
};
