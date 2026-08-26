import { Link, Text } from '@chakra-ui/react';
import { GetTeamDto } from '@edanalytics/models';
import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { RouteObject, Link as RouterLink, useParams } from 'react-router';
import { TeamPage } from '../Pages/Team/TeamPage';
import { TeamsPage } from '../Pages/Team/TeamsPage';
import { teamQueries } from '../api';
import { getRelationDisplayName } from '../helpers';
import { getEntityFromQuery } from '../helpers/getEntityFromQuery';
import { CreateTeam } from '../Pages/Team/CreateTeam';

const TeamBreadcrumb = () => {
  const params = useParams() as { teamId: string };
  const team = useQuery(teamQueries.getOne({ id: params.teamId }));
  return team.data?.displayName ?? params.teamId;
};
export const teamCreateRoute: RouteObject = {
  path: '/teams/create',
  handle: { crumb: () => 'Create' },
  element: <CreateTeam />,
};

export const teamIndexRoute: RouteObject = {
  path: '/teams/:teamId/',
  element: <TeamPage />,
};
export const teamRoute: RouteObject = {
  path: '/teams/:teamId',
  handle: { crumb: TeamBreadcrumb },
};
export const teamsIndexRoute: RouteObject = {
  path: '/teams/',
  element: <TeamsPage />,
};
export const teamsRoute: RouteObject = {
  path: '/teams',
  handle: { crumb: () => 'Teams' },
};

export const TeamLink = (props: {
  id: number | undefined;
  query: UseQueryResult<Record<string | number, GetTeamDto>, unknown>;
}) => {
  const team = getEntityFromQuery(props.id, props.query);
  return team ? (
    <Link as="span">
      <RouterLink title="Go to team" to={`/teams/${team.id}`}>
        {getRelationDisplayName(props.id, props.query)}
      </RouterLink>
    </Link>
  ) : typeof props.id === 'number' ? (
    <Text title="Team may have been deleted, or you lack access." as="i" color="gray.500">
      can't find &#8220;{props.id}&#8221;
    </Text>
  ) : null;
};
