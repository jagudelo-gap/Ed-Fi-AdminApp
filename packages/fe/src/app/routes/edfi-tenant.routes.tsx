import { Link, Text } from '@chakra-ui/react';
import { GetEdfiTenantDto } from '@edanalytics/models';
import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { RouteObject, Link as RouterLink, useParams } from 'react-router';
import { EdfiTenantPage } from '../Pages/EdfiTenant/EdfiTenantPage';
import { EdfiTenantsPage } from '../Pages/EdfiTenant/EdfiTenantsPage';
import { edfiTenantQueries } from '../api';
import { getRelationDisplayName, useNavContext, useTeamSbEnvironmentNavContext } from '../helpers';
import { getEntityFromQuery } from '../helpers/getEntityFromQuery';
import { CreateEdfiTenantPage } from '../Pages/EdfiTenant/CreateEdfiTenantPage';

const EdfiTenantBreadcrumb = () => {
  const params = useParams() as { edfiTenantId: string; asId: string };
  const { sbEnvironmentId } = useTeamSbEnvironmentNavContext();
  const edfiTenant = useQuery(
    edfiTenantQueries.getOne({
      id: params.edfiTenantId,
      teamId: params.asId,
      sbEnvironmentId,
      enabled: sbEnvironmentId !== undefined,
    })
  );
  return edfiTenant.data?.displayName ?? params.edfiTenantId;
};

export const edfiTenantCreateRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/create/',
  element: <CreateEdfiTenantPage />,
};
export const edfiTenantIndexRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/',
  element: <EdfiTenantPage />,
};
export const edfiTenantRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId',
  handle: { crumb: EdfiTenantBreadcrumb },
};

export const edfiTenantsIndexRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/',
  element: <EdfiTenantsPage />,
};
export const edfiTenantsRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants',
  handle: { crumb: () => 'Tenants' },
};

export const EdfiTenantLink = (props: {
  id: number | undefined;
  query: Pick<UseQueryResult<Record<string | number, GetEdfiTenantDto>, unknown>, 'data'>;
}) => {
  const edfiTenant = getEntityFromQuery(props.id, props.query);
  const navContext = useNavContext();
  const asId = navContext.asId!;

  return edfiTenant ? (
    <Link as="span">
      <RouterLink
        title="Go to edfiTenant"
        to={`/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}`}
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
