import { Link, Text } from '@chakra-ui/react';
import { GetSbEnvironmentDto } from '@edanalytics/models';
import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { RouteObject, useParams, Link as RouterLink } from 'react-router';
import { SbEnvironmentGlobalPage } from '../Pages/SbEnvironmentGlobal/SbEnvironmentGlobalPage';
import { SbEnvironmentsGlobalPage } from '../Pages/SbEnvironmentGlobal/SbEnvironmentsGlobalPage';
import { sbEnvironmentQueries } from '../api';
import { getEntityFromQuery } from '../helpers/getEntityFromQuery';
import { CreateSbEnvironmentGlobalPage } from '../Pages/SbEnvironmentGlobal/CreateSbEnvironmentGlobalPage';
import { EditSbEnvironmentGlobalPage } from '../Pages/SbEnvironmentGlobal/EditSbEnvironmentGlobalPage';

const SbEnvironmentGlobalBreadcrumb = () => {
  const params = useParams() as { sbEnvironmentId: string };
  const sbEnvironment = useQuery(sbEnvironmentQueries.getOne({ id: params.sbEnvironmentId }));
  return sbEnvironment.data?.displayName ?? params.sbEnvironmentId;
};

export const sbEnvironmentGlobalCreateRoute: RouteObject = {
  path: '/sb-environments/create',
  element: <CreateSbEnvironmentGlobalPage />,
};
export const sbEnvironmentGlobalEditRoute: RouteObject = {
  path: '/sb-environments/:sbEnvironmentId/edit',
  element: <EditSbEnvironmentGlobalPage />,
};
export const sbEnvironmentGlobalIndexRoute: RouteObject = {
  path: '/sb-environments/:sbEnvironmentId/',
  element: <SbEnvironmentGlobalPage />,
};
export const sbEnvironmentGlobalRoute: RouteObject = {
  path: '/sb-environments/:sbEnvironmentId',
  handle: { crumb: SbEnvironmentGlobalBreadcrumb },
};
export const sbEnvironmentsGlobalIndexRoute: RouteObject = {
  path: '/sb-environments/',
  element: <SbEnvironmentsGlobalPage />,
};
export const sbEnvironmentsGlobalRoute: RouteObject = {
  path: '/sb-environments',
  handle: { crumb: () => 'Environments' },
};

export const SbEnvironmentGlobalLink = (props: {
  id: number | undefined;
  query?: Pick<UseQueryResult<Record<string | number, GetSbEnvironmentDto>, unknown>, 'data'>;
  sbEnvironment?: GetSbEnvironmentDto;
}) => {
  const sbEnvironment = props.sbEnvironment ?? (props.query ? getEntityFromQuery(props.id, props.query) : undefined);
  return sbEnvironment ? (
    <Link as="span">
      <RouterLink title="Go to environment" to={`/sb-environments/${sbEnvironment.id}`}>
        {sbEnvironment.displayName}
      </RouterLink>
    </Link>
  ) : typeof props.id === 'number' ? (
    <Text title="Environment may have been deleted, or you lack access." as="i" color="gray.500">
      can't find &#8220;{props.id}&#8221;
    </Text>
  ) : null;
};
