import { Link, Text } from '@chakra-ui/react';
import { GetOwnershipDto, GetOwnershipViewDto } from '@edanalytics/models';
import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { RouteObject, Link as RouterLink, useParams } from 'react-router';
import { CreateOwnershipGlobalPage } from '../Pages/OwnershipGlobal/CreateOwnershipGlobalPage';
import { OwnershipGlobalPage } from '../Pages/OwnershipGlobal/OwnershipGlobalPage';
import { OwnershipsGlobalPage } from '../Pages/OwnershipGlobal/OwnershipsGlobalPage';
import { ownershipQueries } from '../api';
import { getRelationDisplayName } from '../helpers';
import { getEntityFromQuery } from '../helpers/getEntityFromQuery';

const OwnershipGlobalBreadcrumb = () => {
  const params = useParams() as { ownershipId: string };
  const ownership = useQuery(ownershipQueries.getOne({ id: params.ownershipId }));
  return ownership.data?.displayName ?? params.ownershipId;
};
export const ownershipGlobalCreateRoute: RouteObject = {
  path: '/ownerships/create',
  handle: { crumb: () => 'Create' },
  element: <CreateOwnershipGlobalPage />,
};

export const ownershipGlobalIndexRoute: RouteObject = {
  path: '/ownerships/:ownershipId/',
  element: <OwnershipGlobalPage />,
};
export const ownershipGlobalRoute: RouteObject = {
  path: '/ownerships/:ownershipId',
  handle: { crumb: OwnershipGlobalBreadcrumb },
};
export const ownershipsGlobalIndexRoute: RouteObject = {
  path: '/ownerships/',
  element: <OwnershipsGlobalPage />,
};
export const ownershipsGlobalRoute: RouteObject = {
  path: '/ownerships',
  handle: { crumb: () => 'Ownerships' },
};

export const OwnershipGlobalLink = (props: {
  id: number | undefined;
  query: UseQueryResult<Record<string | number, GetOwnershipDto | GetOwnershipViewDto>, unknown>;
}) => {
  const ownership = getEntityFromQuery(props.id, props.query);
  return ownership ? (
    <Link as="span">
      <RouterLink title="Go to ownership" to={`/ownerships/${ownership.id}`}>
        {getRelationDisplayName(props.id, props.query)}
      </RouterLink>
    </Link>
  ) : typeof props.id === 'number' ? (
    <Text title="Ownership may have been deleted, or you lack access." as="i" color="gray.500">
      can't find &#8220;{props.id}&#8221;
    </Text>
  ) : null;
};
