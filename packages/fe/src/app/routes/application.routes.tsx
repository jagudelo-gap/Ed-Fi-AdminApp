import { Link, Text } from '@chakra-ui/react';
import { GetApplicationDto, GetApplicationDtoV2, GetApplicationDtoV3 } from '@edanalytics/models';
import { UseQueryOptions, UseQueryResult, useQuery } from '@tanstack/react-query';
import { RouteObject, Link as RouterLink, useParams } from 'react-router';
import { ApplicationPage } from '../Pages/Application/ApplicationPage';
import { ApplicationsPage } from '../Pages/Application/ApplicationsPage';
import { CreateApplicationPage } from '../Pages/Application/CreateApplicationPage';
import { ApplicationPageV2 } from '../Pages/ApplicationV2Plus/ApplicationPage';
import { ApplicationsPageV2 } from '../Pages/ApplicationV2Plus/ApplicationsPage';
import { CreateApplicationPageV2 } from '../Pages/ApplicationV2Plus/CreateApplicationPage';
import { applicationQueriesV1, applicationQueriesV2, applicationQueriesV3 } from '../api';
import { createVersionedResource } from '../api/queries/versioned';
import {
  VersioningHoc,
  getRelationDisplayName,
  useTeamEdfiTenantNavContextLoaded,
  withLoader,
} from '../helpers';
import { getEntityFromQuery } from '../helpers/getEntityFromQuery';

const ApplicationBreadcrumbV1 = () => {
  const params = useParams() as { applicationId: string };
  const { edfiTenant, teamId } = useTeamEdfiTenantNavContextLoaded();
  const application = useQuery(
    applicationQueriesV1.getOne({
      id: params.applicationId,
      teamId,
      edfiTenant,
    })
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (application.data?.displayName ?? params.applicationId) as any;
};
// v2/v3 breadcrumbs are byte-for-byte identical except which queries module
// they call — same dedupe shape as vendor.routes.tsx's useVendorBreadcrumbQueries.
// Unlike vendor's V2/V3 DTOs (structurally identical), Application's V2/V3
// `getOne` return types differ (odsInstanceIds vs dataStoreIds), so this must
// be a real discriminated union rather than one shared function type.
type ApplicationBreadcrumbConfig =
  | { version: 'v2'; getOne: typeof applicationQueriesV2.getOne }
  | { version: 'v3'; getOne: typeof applicationQueriesV3.getOne };

const useApplicationBreadcrumbQueries = createVersionedResource<ApplicationBreadcrumbConfig>({
  v2: { version: 'v2', getOne: applicationQueriesV2.getOne },
  v3: { version: 'v3', getOne: applicationQueriesV3.getOne },
});

const ApplicationBreadcrumbV2Plus = () => {
  const params = useParams() as { applicationId: string };
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const { getOne } = useApplicationBreadcrumbQueries();
  // TypeScript cannot resolve union-typed overloaded functions; cast to the
  // actual return type. Same workaround as ClaimsetPage.tsx's ClaimsetPageTitle.
  const application = useQuery(
    getOne({ id: params.applicationId, edfiTenant, teamId }) as UseQueryOptions<
      GetApplicationDtoV2 | GetApplicationDtoV3
    >
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (application.data?.displayName ?? params.applicationId) as any;
};
export const applicationIndexRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/applications/:applicationId/',
  element: <VersioningHoc v1={<ApplicationPage />} v2={<ApplicationPageV2 />} v3={<ApplicationPageV2 />} />,
};
export const applicationCreateRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/applications/create',
  handle: { crumb: () => 'Create' },
  element: (
    <VersioningHoc v1={<CreateApplicationPage />} v2={<CreateApplicationPageV2 />} v3={<CreateApplicationPageV2 />} />
  ),
};

export const applicationRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/applications/:applicationId',
  handle: {
    crumb: withLoader(() => (
      <VersioningHoc
        v1={<ApplicationBreadcrumbV1 />}
        v2={<ApplicationBreadcrumbV2Plus />}
        v3={<ApplicationBreadcrumbV2Plus />}
      />
    )),
    fallbackCrumb: () => 'Application',
  },
};
export const applicationsIndexRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/applications/',
  element: <VersioningHoc v1={<ApplicationsPage />} v2={<ApplicationsPageV2 />} v3={<ApplicationsPageV2 />} />,
};
export const applicationsRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/applications',
  handle: { crumb: () => 'Applications' },
};

export const ApplicationLinkV1 = (props: {
  id: number | undefined;
  query: UseQueryResult<Record<string | number, GetApplicationDto>, unknown>;
  edfiTenantId?: string | number;
}) => {
  const application = getEntityFromQuery(props.id, props.query);
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();

  return application ? (
    <Link as="span">
      <RouterLink
        title="Go to application"
        to={`/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/applications/${application.id}`}
      >
        {getRelationDisplayName(props.id, props.query)}
      </RouterLink>
    </Link>
  ) : props.id !== null && props.id !== undefined ? (
    <Text title="Application may have been deleted, or you lack access." as="i" color="gray.500">
      can't find &#8220;{props.id}&#8221;
    </Text>
  ) : null;
};

export const ApplicationLinkV2 = (props: {
  id: number | undefined;
  query: UseQueryResult<Record<string | number, GetApplicationDtoV2>, unknown>;
  edfiTenantId?: string | number;
}) => {
  const application = getEntityFromQuery(props.id, props.query);
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();

  return application ? (
    <Link as="span">
      <RouterLink
        title="Go to application"
        to={`/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/applications/${application.id}`}
      >
        {getRelationDisplayName(props.id, props.query)}
      </RouterLink>
    </Link>
  ) : props.id !== null && props.id !== undefined ? (
    <Text title="Application may have been deleted, or you lack access." as="i" color="gray.500">
      can't find &#8220;{props.id}&#8221;
    </Text>
  ) : null;
};
