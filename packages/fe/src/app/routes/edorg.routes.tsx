import { Link, Text } from '@chakra-ui/react';
import { GetEdorgDto } from '@edanalytics/models';
import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { RouteObject, Link as RouterLink, useParams } from 'react-router';
import { EdorgPage } from '../Pages/Edorg/EdorgPage';
import { EdorgsPage } from '../Pages/Edorg/EdorgsPage';
import { edorgQueries } from '../api';
import {
  VersioningHoc,
  getRelationDisplayName,
  useTeamEdfiTenantNavContextLoaded,
} from '../helpers';
import { getEntityFromQuery } from '../helpers/getEntityFromQuery';
import { CreateEdorg } from '../Pages/Edorg/CreateEdorgPage';

const EdorgBreadcrumb = () => {
  const params = useParams() as { edorgId: string };
  const { edfiTenant, teamId } = useTeamEdfiTenantNavContextLoaded();
  const edorg = useQuery(
    edorgQueries.getOne({
      id: params.edorgId,
      teamId,
      edfiTenant,
    })
  );
  return edorg.data?.displayName ?? params.edorgId;
};
export const edorgIndexRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/edorgs/:edorgId/',
  element: <EdorgPage />,
};
export const edorgCreateRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/edorgs/create',
  element: <VersioningHoc v2={<CreateEdorg />} v3={<CreateEdorg />} />,
  handle: { crumb: () => 'Create ed-org' },
};

export const edorgRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/edorgs/:edorgId',
  handle: { crumb: EdorgBreadcrumb },
};
export const edorgsIndexRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/edorgs/',
  element: <EdorgsPage />,
};
export const edorgsRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/edorgs',
  handle: { crumb: () => 'Ed-Orgs' },
};

export const EdorgLink = (props: {
  id: number | string | undefined;
  query: Pick<UseQueryResult<Record<string | number, GetEdorgDto>, unknown>, 'data'>;
}) => {
  const edorg = getEntityFromQuery(props.id, props.query);
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();

  return edorg ? (
    <Link as="span">
      <RouterLink
        title="Go to edorg"
        to={`/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/edorgs/${edorg.id}`}
      >
        {getRelationDisplayName(props.id, props.query)}
      </RouterLink>
    </Link>
  ) : props.id !== null && props.id !== undefined ? (
    <Text title="Ed-Org may have been deleted, or you lack access." as="i" color="gray.500">
      can't find &#8220;{props.id}&#8221;
    </Text>
  ) : null;
};
