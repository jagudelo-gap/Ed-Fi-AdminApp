import { Link, Text } from '@chakra-ui/react';
import { GetEdfiTenantDto } from '@edanalytics/models';
import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { RouteObject, useParams, Link as RouterLink } from 'react-router';
import { EdfiTenantGlobalPage } from '../Pages/EdfiTenantGlobal/EdfiTenantGlobalPage';
import { EdfiTenantsGlobalPage } from '../Pages/EdfiTenantGlobal/EdfiTenantsGlobalPage';
import { edfiTenantQueriesGlobal } from '../api';
import { getRelationDisplayName } from '../helpers';
import { getEntityFromQuery } from '../helpers/getEntityFromQuery';
import { CreateEdfiTenantGlobalPage } from '../Pages/EdfiTenantGlobal/CreateEdfiTenantGlobalPage';

const EdfiTenantGlobalBreadcrumb = () => {
  const params = useParams() as { edfiTenantId: string; sbEnvironmentId: string };
  const edfiTenant = useQuery(
    edfiTenantQueriesGlobal.getOne({
      id: params.edfiTenantId,
      sbEnvironmentId: params.sbEnvironmentId,
    })
  );
  return edfiTenant.data?.displayName ?? params.edfiTenantId;
};

export const edfiTenantGlobalCreateRoute: RouteObject = {
  path: '/sb-environments/:sbEnvironmentId/edfi-tenants/create',
  element: <CreateEdfiTenantGlobalPage />,
};
export const edfiTenantGlobalIndexRoute: RouteObject = {
  path: '/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/',
  element: <EdfiTenantGlobalPage />,
};
export const edfiTenantGlobalRoute: RouteObject = {
  path: '/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId',
  handle: { crumb: EdfiTenantGlobalBreadcrumb },
};
export const edfiTenantsGlobalIndexRoute: RouteObject = {
  path: '/sb-environments/:sbEnvironmentId/edfi-tenants/',
  element: <EdfiTenantsGlobalPage />,
};
export const edfiTenantsGlobalRoute: RouteObject = {
  path: '/sb-environments/:sbEnvironmentId/edfi-tenants',
  handle: { crumb: () => 'Tenants' },
};

export const EdfiTenantGlobalLink = (props: {
  id: number | undefined;
  query: Pick<UseQueryResult<Record<string | number, GetEdfiTenantDto>, unknown>, 'data'>;
}) => {
  const edfiTenant = getEntityFromQuery(props.id, props.query);
  return edfiTenant ? (
    <Link as="span">
      <RouterLink
        title="Go to edfiTenant"
        to={`/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}`}
      >
        {getRelationDisplayName(props.id, props.query)}
      </RouterLink>
    </Link>
  ) : typeof props.id === 'number' ? (
    <Text title="EdfiTenant may have been deleted, or you lack access." as="i" color="gray.500">
      can't find &#8220;{props.id}&#8221;
    </Text>
  ) : null;
};
