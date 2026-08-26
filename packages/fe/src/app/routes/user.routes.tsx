import { Link, Text } from '@chakra-ui/react';
import { GetUserDto } from '@edanalytics/models';
import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { RouteObject, Link as RouterLink, useParams } from 'react-router';
import { UserPage } from '../Pages/Team/User/UserPage';
import { UsersPage } from '../Pages/Team/User/UsersPage';
import { userQueries } from '../api';
import { getRelationDisplayName, useAuthorize, useNavContext } from '../helpers';
import { getEntityFromQuery } from '../helpers/getEntityFromQuery';

const UserBreadcrumb = () => {
  const params = useParams() as { userId: string; asId: string };
  const user = useQuery(
    userQueries.getOne({
      id: params.userId,
      teamId: params.asId,
    })
  );
  return user.data?.displayName ?? params.userId;
};

export const userIndexRoute: RouteObject = {
  path: '/as/:asId/users/:userId/',
  element: <UserPage />,
};
export const userRoute: RouteObject = {
  path: '/as/:asId/users/:userId',
  handle: { crumb: UserBreadcrumb },
};

export const usersIndexRoute: RouteObject = {
  path: '/as/:asId/users/',
  element: <UsersPage />,
};
export const usersRoute: RouteObject = {
  path: '/as/:asId/users',
  handle: { crumb: () => 'Users' },
};

export const UserLink = (props: {
  id: number | undefined;
  /**@deprecated unneeded and no longer used. */
  query?: UseQueryResult<Record<string | number, GetUserDto>, unknown>;
}) => {
  const navContext = useNavContext();
  const asId = navContext.asId!;

  const users = useQuery({
    ...userQueries.getAll({
      teamId: asId,
    }),
    enabled: useAuthorize({
      privilege: 'team.user:read',
      subject: {
        id: '__filtered__',
        teamId: asId,
      },
    }),
  });
  const user = getEntityFromQuery(props.id, users);
  return user ? (
    <Link as="span">
      <RouterLink title="Go to user" to={`/as/${asId}/users/${user.id}`}>
        {getRelationDisplayName(props.id, users)}
      </RouterLink>
    </Link>
  ) : typeof props.id === 'number' ? (
    <Text title="User may have been deleted, or you lack access." as="i" color="gray.500">
      can't find &#8220;{props.id}&#8221;
    </Text>
  ) : null;
};
