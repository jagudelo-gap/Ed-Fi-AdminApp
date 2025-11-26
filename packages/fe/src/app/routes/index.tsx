import { ChakraProvider } from '@chakra-ui/react';
import { globalTheme } from '@edanalytics/common-ui';
import { memo, useEffect } from 'react';
import { Outlet, RouteObject, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { ErrorFallback } from '../Layout/Fallback404';
import { PublicAppLayout } from '../Layout/PublicAppLayout';
import { StandardLayout } from '../Layout/StandardLayout';
import { TeamHome } from '../Pages/Home/TeamHome';
import { useSearchParamsObject } from '../helpers/useSearch';
import {config} from '../../../typings/config';

import { accountRouteGlobal } from './account.routes';
import {
  applicationCreateRoute,
  applicationIndexRoute,
  applicationRoute,
  applicationsIndexRoute,
  applicationsRoute,
} from './application.routes';
import {
  claimsetCopyRoute,
  claimsetCreateRoute,
  claimsetImportRoute,
  claimsetIndexRoute,
  claimsetRoute,
  claimsetsIndexRoute,
  claimsetsRoute,
} from './claimset.routes';
import {
  edfiTenantCreateRoute,
  edfiTenantIndexRoute,
  edfiTenantRoute,
  edfiTenantsIndexRoute,
  edfiTenantsRoute,
} from './edfi-tenant.routes';
import {
  edfiTenantGlobalCreateRoute,
  edfiTenantGlobalIndexRoute,
  edfiTenantGlobalRoute,
  edfiTenantsGlobalIndexRoute,
  edfiTenantsGlobalRoute,
} from './edfi-tenant-global.routes';
import {
  edorgCreateRoute,
  edorgIndexRoute,
  edorgRoute,
  edorgsIndexRoute,
  edorgsRoute,
} from './edorg.routes';
import { integrationAppsTeamRoutes } from './integration-apps-team.routes';
import {
  integrationProvidersGlobalRoutes,
  integrationProvidersTeamRoutes,
} from './integration-providers-global.routes';
import { odsCreateRoute, odsIndexRoute, odsRoute, odssIndexRoute, odssRoute } from './ods.routes';
import {
  ownershipGlobalCreateRoute,
  ownershipGlobalIndexRoute,
  ownershipGlobalRoute,
  ownershipsGlobalIndexRoute,
  ownershipsGlobalRoute,
} from './ownership-global.routes';
import {
  ownershipIndexRoute,
  ownershipRoute,
  ownershipsIndexRoute,
  ownershipsRoute,
} from './ownership.routes';
import {
  profileCreateRoute,
  profileIndexRoute,
  profileRoute,
  profilesIndexRoute,
  profilesRoute,
} from './profile.routes';
import { roleIndexRoute, roleRoute, rolesIndexRoute, rolesRoute } from './role.routes';
import {
  roleGlobalCreateRoute,
  roleGlobalIndexRoute,
  roleGlobalRoute,
  rolesGlobalIndexRoute,
  rolesGlobalRoute,
} from './role-global.routes';
import {
  sbEnvironmentIndexRoute,
  sbEnvironmentRoute,
  sbEnvironmentsIndexRoute,
  sbEnvironmentsRoute,
} from './sb-environment.routes';
import {
  sbEnvironmentGlobalCreateRoute,
  sbEnvironmentGlobalEditRoute,
  sbEnvironmentGlobalIndexRoute,
  sbEnvironmentGlobalRoute,
  sbEnvironmentsGlobalIndexRoute,
  sbEnvironmentsGlobalRoute,
} from './sb-environment-global.routes';
import {
  sbSyncQueuesRoute,
  sbSyncQueuesIndexRoute,
  sbSyncQueueRoute,
  sbSyncQueueIndexRoute,
} from './sb-sync-queue.routes';
import { secretRoute } from './secret.routes';
import {
  teamCreateRoute,
  teamIndexRoute,
  teamRoute,
  teamsIndexRoute,
  teamsRoute,
} from './team.routes';
import { userIndexRoute, userRoute, usersIndexRoute, usersRoute } from './user.routes';
import {
  usersGlobalRoute,
  usersGlobalIndexRoute,
  userGlobalRoute,
  userGlobalIndexRoute,
  userGlobalCreateRoute,
} from './user-global.routes';
import {
  utmsGlobalRoute,
  utmsGlobalIndexRoute,
  utmGlobalRoute,
  utmGlobalIndexRoute,
  utmGlobalCreateRoute,
} from './utm-global.routes';
import {
  vendorIndexRoute,
  vendorCreateRoute,
  vendorRoute,
  vendorsIndexRoute,
  vendorsRoute,
} from './vendor.routes';
import { API_URL } from '../api/methods';

import { GlobalHome } from '../Pages/Home/GlobalHome';
import { UnauthenticatedPage } from '../Layout/Unauthenticated';
import { useMe } from '../api';
import { LandingLayoutRouteElement } from '../Layout/LandingLayout';

export * from './account.routes';
export * from './application.routes';
export * from './claimset.routes';
export * from './edorg.routes';
export * from './ods.routes';
export * from './ownership.routes';
export * from './ownership-global.routes';
export * from './edfi-tenant.routes';
export * from './edfi-tenant-global.routes';
export * from './profile.routes';
export * from './role.routes';
export * from './sb-environment.routes';
export * from './sb-environment-global.routes';
export * from './sb-sync-queue.routes';
export * from './team.routes';
export * from './user.routes';
export * from './user-global.routes';
export * from './utm-global.routes';
export * from './vendor.routes';

export const fallback404Route: RouteObject = {
  path: '*',
  element: <ErrorFallback />,
};

export const indexRoute: RouteObject = {
  path: '/',
  element: <GlobalHome />,
};
export const unauthenticatedRoute: RouteObject = {
  path: '/unauthenticated',
  element: <UnauthenticatedPage />,
};
const Login = memo(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { redirect } = useSearchParamsObject() as any;
  useEffect(() => {
    // TODO the backend supports multiple (trusted) IdPs, so maybe we should support that here with some kind of login screen
    window.location.href = `${API_URL}/auth/login/${config.oidcId || 1}${
      redirect ? `?redirect=${redirect}` : ''
    }`;
  }, []);
  return null;
});
export const loginRoute: RouteObject = {
  path: '/login',
  element: <Login />,
  errorElement: <ErrorFallback />,
};
export const asRoute: RouteObject = {
  path: '/as/:asId',
  element: <TeamHome />,
};

export const landingLayoutRoute: RouteObject = {
  element: <LandingLayoutRouteElement />,
  errorElement: <ErrorFallback />,
  children: [unauthenticatedRoute],
};
export const publicLayoutRoute: RouteObject = {
  element: <PublicAppLayout />,
  errorElement: <ErrorFallback />,
  children: [landingLayoutRoute, secretRoute],
};

const AuthenticatedRoute = () => {
  const me = useMe();
  if (me.isPending || me.data === undefined) {
    return null;
  } else if (me.data === null) {
    window.location.href = `${window.location.origin}/login?redirect=${encodeURIComponent(
      window.location.href.replace(window.location.origin, '')
    )}`;
    return null;
  }
  return <Outlet />;
};

export const adminRoutes: RouteObject = {
  element: (
    <ChakraProvider theme={globalTheme}>
      <Outlet />
    </ChakraProvider>
  ),
  errorElement: <ErrorFallback />,
  children: [
    sbEnvironmentsGlobalRoute,
    sbEnvironmentsGlobalIndexRoute,
    sbEnvironmentGlobalCreateRoute,
    sbEnvironmentGlobalEditRoute,
    sbEnvironmentGlobalRoute,
    sbEnvironmentGlobalIndexRoute,

    teamsRoute,
    teamsIndexRoute,
    teamRoute,
    teamIndexRoute,
    teamCreateRoute,

    usersGlobalRoute,
    usersGlobalIndexRoute,
    userGlobalCreateRoute,
    userGlobalRoute,
    userGlobalIndexRoute,

    utmsGlobalRoute,
    utmsGlobalIndexRoute,
    utmGlobalRoute,
    utmGlobalIndexRoute,
    utmGlobalCreateRoute,

    rolesGlobalRoute,
    rolesGlobalIndexRoute,
    roleGlobalCreateRoute,
    roleGlobalRoute,
    roleGlobalIndexRoute,

    ownershipsGlobalRoute,
    ownershipsGlobalIndexRoute,
    ownershipGlobalRoute,
    ownershipGlobalIndexRoute,
    ownershipGlobalCreateRoute,

    sbSyncQueuesRoute,
    sbSyncQueuesIndexRoute,
    sbSyncQueueRoute,
    sbSyncQueueIndexRoute,

    edfiTenantsGlobalRoute,
    edfiTenantsGlobalIndexRoute,
    edfiTenantGlobalCreateRoute,
    edfiTenantGlobalRoute,
    edfiTenantGlobalIndexRoute,

    ...integrationProvidersGlobalRoutes,
  ],
};
export const authenticatedRoutes: RouteObject = {
  element: <AuthenticatedRoute />,
  errorElement: <ErrorFallback />,
  children: [
    edfiTenantsRoute,
    edfiTenantsIndexRoute,
    edfiTenantRoute,
    edfiTenantIndexRoute,
    edfiTenantCreateRoute,

    sbEnvironmentsRoute,
    sbEnvironmentsIndexRoute,
    sbEnvironmentRoute,
    sbEnvironmentIndexRoute,

    odssRoute,
    odssIndexRoute,
    odsRoute,
    odsIndexRoute,
    odsCreateRoute,

    rolesRoute,
    rolesIndexRoute,
    roleRoute,
    roleIndexRoute,

    usersRoute,
    usersIndexRoute,
    userRoute,
    userIndexRoute,

    ownershipsRoute,
    ownershipsIndexRoute,
    ownershipRoute,
    ownershipIndexRoute,

    edorgsRoute,
    edorgCreateRoute,
    edorgsIndexRoute,
    edorgRoute,
    edorgIndexRoute,

    claimsetsRoute,
    claimsetsIndexRoute,
    claimsetRoute,
    claimsetIndexRoute,
    claimsetCreateRoute,
    claimsetCopyRoute,
    claimsetImportRoute,

    applicationsRoute,
    applicationsIndexRoute,
    applicationRoute,
    applicationIndexRoute,
    applicationCreateRoute,

    vendorsRoute,
    vendorsIndexRoute,
    vendorRoute,
    vendorIndexRoute,
    vendorCreateRoute,

    accountRouteGlobal,

    profileRoute,
    profilesRoute,
    profileIndexRoute,
    profilesIndexRoute,
    profileCreateRoute,

    ...integrationAppsTeamRoutes,
    ...integrationProvidersTeamRoutes,

    asRoute,
    adminRoutes,
  ],
};

export const mainLayoutRoute: RouteObject = {
  element: <StandardLayout />,
  errorElement: <ErrorFallback />,
  handle: { crumb: () => 'Home' },
  children: [indexRoute, authenticatedRoutes],
};
export const routes = [mainLayoutRoute, publicLayoutRoute, loginRoute, fallback404Route];
const addPathToHandle = (r: RouteObject) => {
  r.handle = {
    ...r.handle,
    path: r.path,
  };
  r.children?.forEach((route) => addPathToHandle(route));
};
routes.forEach(addPathToHandle);
const flattenRoute = (r: RouteObject): RouteObject[] =>
  [r, ...(r.children ?? []).map((route) => flattenRoute(route))].flat();
const router = createBrowserRouter(routes, {
  basename: config.basePath || '/'
});
export const flatRoutes = routes.flatMap(flattenRoute);
export const Routes = () => {
  return <RouterProvider router={router} />;
};
