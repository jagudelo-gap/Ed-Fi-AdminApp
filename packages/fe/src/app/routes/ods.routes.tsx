import { Link, Text } from '@chakra-ui/react';
import { GetOdsDto } from '@edanalytics/models';
import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { RouteObject, Link as RouterLink, useParams } from 'react-router';
import { OdsPage } from '../Pages/Ods/OdsPage';
import { OdssPage } from '../Pages/Ods/OdssPage';
import { odsQueries } from '../api';
import { getRelationDisplayName, useTeamEdfiTenantNavContextLoaded, withLoader } from '../helpers';
import { getEntityFromQuery } from '../helpers/getEntityFromQuery';
import { CreateOds } from '../Pages/Ods/CreateOdsPage';
import { useOdsTerminology } from '../Pages/Ods/useOdsTerminology';

const OdsBreadcrumb = withLoader(() => {
  const params = useParams() as { odsId: string };
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const ods = useQuery(
    odsQueries.getOne({
      id: params.odsId,
      teamId,
      edfiTenant,
    })
  );
  return <>{ods.data?.displayName ?? params.odsId}</>;
});
const CreateOdsCrumb = withLoader(() => {
  const terminology = useOdsTerminology();
  return <>{`Create ${terminology.singular}`}</>;
});
const OdssCrumb = withLoader(() => {
  const terminology = useOdsTerminology();
  return <>{terminology.plural}</>;
});
export const odsCreateRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/odss/create',
  element: <CreateOds />,
  handle: { crumb: CreateOdsCrumb },
};
export const odsIndexRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/odss/:odsId/',
  element: <OdsPage />,
};

export const odsRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/odss/:odsId',
  handle: { crumb: OdsBreadcrumb },
};
export const odssIndexRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/odss/',
  element: <OdssPage />,
};
export const odssRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/odss',
  handle: { crumb: OdssCrumb },
};

export const OdsLink = (props: {
  id: number | undefined;
  query: Pick<UseQueryResult<Record<string | number, GetOdsDto>, unknown>, 'data'>;
}) => {
  const ods = getEntityFromQuery(props.id, props.query);
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const terminology = useOdsTerminology();

  return ods ? (
    <Link as="span">
      <RouterLink
        title={`Go to ${terminology.singular}`}
        to={`/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/odss/${ods.id}`}
      >
        {getRelationDisplayName(props.id, props.query)}
      </RouterLink>
    </Link>
  ) : typeof props.id === 'number' ? (
    <Text title={`${terminology.singular} may have been deleted, or you lack access.`} as="i" color="gray.500">
      can't find &#8220;{props.id}&#8221;
    </Text>
  ) : null;
};
