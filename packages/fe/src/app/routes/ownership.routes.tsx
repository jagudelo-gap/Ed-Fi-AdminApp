import { Link, Text } from '@chakra-ui/react';
import { GetOwnershipDto } from '@edanalytics/models';
import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { RouteObject, Link as RouterLink, useParams } from 'react-router';
import { OwnershipPage } from '../Pages/Ownership/OwnershipPage';
import { OwnershipsPage } from '../Pages/Ownership/OwnershipsPage';
import { ownershipQueries } from '../api';
import { getRelationDisplayName, useNavContext } from '../helpers';
import { getEntityFromQuery } from '../helpers/getEntityFromQuery';

const OwnershipBreadcrumb = () => {
  const params = useParams() as { ownershipId: string; asId: string };
  const ownership = useQuery(
    ownershipQueries.getOne({
      id: params.ownershipId,
      teamId: params.asId,
    })
  );
  return ownership.data?.displayName ?? params.ownershipId;
};

export const ownershipIndexRoute: RouteObject = {
  path: '/as/:asId/ownerships/:ownershipId/',
  element: <OwnershipPage />,
};
export const ownershipRoute: RouteObject = {
  path: '/as/:asId/ownerships/:ownershipId',
  handle: { crumb: OwnershipBreadcrumb },
};

export const ownershipsIndexRoute: RouteObject = {
  path: '/as/:asId/ownerships/',
  element: <OwnershipsPage />,
};
export const ownershipsRoute: RouteObject = {
  path: '/as/:asId/ownerships',
  handle: { crumb: () => 'Ownerships' },
};

export const OwnershipLink = (props: {
  id: number | undefined;
  query: UseQueryResult<Record<string | number, GetOwnershipDto>, unknown>;
}) => {
  const ownership = getEntityFromQuery(props.id, props.query);
  const navContext = useNavContext();
  const asId = navContext.asId!;

  return ownership ? (
    <Link as="span">
      <RouterLink title="Go to ownership" to={`/as/${asId}/ownerships/${ownership.id}`}>
        {getRelationDisplayName(props.id, props.query)}
      </RouterLink>
    </Link>
  ) : typeof props.id === 'number' ? (
    <Text title="Ownership may have been deleted, or you lack access." as="i" color="gray.500">
      can't find &#8220;{props.id}&#8221;
    </Text>
  ) : null;
};
