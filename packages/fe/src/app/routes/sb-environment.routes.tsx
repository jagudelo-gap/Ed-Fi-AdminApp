import { Link, Text } from '@chakra-ui/react';
import { GetSbEnvironmentDto } from '@edanalytics/models';
import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { RouteObject, Link as RouterLink, useParams } from 'react-router';
import { SbEnvironmentPage } from '../Pages/SbEnvironment/SbEnvironmentPage';
import { SbEnvironmentsPage } from '../Pages/SbEnvironment/SbEnvironmentsPage';
import { sbEnvironmentQueries } from '../api';
import { getRelationDisplayName, useNavContext } from '../helpers';
import { getEntityFromQuery } from '../helpers/getEntityFromQuery';

const SbEnvironmentBreadcrumb = () => {
  const params = useParams() as { sbEnvironmentId: string; asId: string };
  const sbEnvironment = useQuery(
    sbEnvironmentQueries.getOne({
      id: params.sbEnvironmentId,
      teamId: params.asId,
    })
  );
  return sbEnvironment.data?.displayName ?? params.sbEnvironmentId;
};

export const sbEnvironmentIndexRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/',
  element: <SbEnvironmentPage />,
};
export const sbEnvironmentRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId',
  handle: { crumb: SbEnvironmentBreadcrumb },
};

export const sbEnvironmentsIndexRoute: RouteObject = {
  path: '/as/:asId/sb-environments/',
  element: <SbEnvironmentsPage />,
};
export const sbEnvironmentsRoute: RouteObject = {
  path: '/as/:asId/sb-environments',
  handle: { crumb: () => 'Environments' },
};

export const SbEnvironmentLink = (props: {
  id: number | undefined;
  query: Pick<UseQueryResult<Record<string | number, GetSbEnvironmentDto>, unknown>, 'data'>;
}) => {
  const sbEnvironment = getEntityFromQuery(props.id, props.query);
  const navContext = useNavContext();
  const asId = navContext.asId!;

  return sbEnvironment ? (
    <Link as="span">
      <RouterLink title="Go to environment" to={`/as/${asId}/sb-environments/${sbEnvironment.id}`}>
        {getRelationDisplayName(props.id, props.query)}
      </RouterLink>
    </Link>
  ) : typeof props.id === 'number' ? (
    <Text title="Environment may have been deleted, or you lack access." as="i" color="gray.500">
      can't find &#8220;{props.id}&#8221;
    </Text>
  ) : null;
};
