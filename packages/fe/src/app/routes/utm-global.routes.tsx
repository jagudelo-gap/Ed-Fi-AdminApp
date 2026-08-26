import { Link, Text } from '@chakra-ui/react';
import { GetUserTeamMembershipDto } from '@edanalytics/models';
import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { RouteObject, Link as RouterLink, useParams } from 'react-router';
import { CreateUtmGlobal } from '../Pages/UserTeamMembershipGlobal/CreateUtmGlobal';
import { UtmGlobalPage } from '../Pages/UserTeamMembershipGlobal/UtmPageGlobal';
import { UtmsGlobalPage } from '../Pages/UserTeamMembershipGlobal/UtmsPageGlobal';
import { userTeamMembershipQueries } from '../api';
import { getRelationDisplayName } from '../helpers';
import { getEntityFromQuery } from '../helpers/getEntityFromQuery';

const UtmGlobalBreadcrumb = () => {
  const params = useParams() as { userTeamMembershipId: string };
  const utm = useQuery(userTeamMembershipQueries.getOne({ id: params.userTeamMembershipId }));
  return utm.data?.displayName ?? params.userTeamMembershipId;
};

export const utmGlobalCreateRoute: RouteObject = {
  path: '/user-team-memberships/create',
  handle: { crumb: () => 'Create' },
  element: <CreateUtmGlobal />,
};
export const utmGlobalIndexRoute: RouteObject = {
  path: '/user-team-memberships/:userTeamMembershipId/',
  element: <UtmGlobalPage />,
};
export const utmGlobalRoute: RouteObject = {
  path: '/user-team-memberships/:userTeamMembershipId',
  handle: { crumb: UtmGlobalBreadcrumb },
};
export const utmsGlobalIndexRoute: RouteObject = {
  path: '/user-team-memberships/',
  element: <UtmsGlobalPage />,
};
export const utmsGlobalRoute: RouteObject = {
  path: '/user-team-memberships',
  handle: { crumb: () => 'Team memberships' },
};

export const UtmGlobalLink = (props: {
  id: number | undefined;
  query: UseQueryResult<Record<string | number, GetUserTeamMembershipDto>, unknown>;
}) => {
  const utm = getEntityFromQuery(props.id, props.query);
  return utm ? (
    <Link as="span">
      <RouterLink title="Go to team membership" to={`/user-team-memberships/${utm.id}`}>
        {getRelationDisplayName(props.id, props.query)}
      </RouterLink>
    </Link>
  ) : typeof props.id === 'number' ? (
    <Text
      title="Team membership may have been deleted, or you lack access."
      as="i"
      color="gray.500"
    >
      can't find &#8220;{props.id}&#8221;
    </Text>
  ) : null;
};
