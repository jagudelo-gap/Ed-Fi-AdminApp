import { type RouteObject } from 'react-router';
import { ManyIntegrationProvidersPage } from '../Pages/IntegrationProvider/ManyIntegrationProvidersPage';
import { CreateIntegrationProviderPage } from '../Pages/IntegrationProvider/CreateIntegrationProviderPage';
import { OneIntegrationProviderPage } from '../Pages/IntegrationProvider/OneIntegrationProviderPage';
import { IntegrationProviderBreadcrumb } from '../Pages/IntegrationProvider/IntegrationProviderBreadcrumb';
import { routeDefinitions } from './paths';

const integrationProvidersGlobalIndexRoute: RouteObject = {
  path: routeDefinitions.integrationProvider.index,
  element: <ManyIntegrationProvidersPage />,
  handle: { crumb: () => 'Integration Providers' },
};

export const integrationProviderGlobalCreateRoute: RouteObject = {
  path: routeDefinitions.integrationProvider.create,
  handle: { crumb: () => 'Create' },
  element: <CreateIntegrationProviderPage />,
};

export const integrationProviderGlobalViewRoute: RouteObject = {
  path: routeDefinitions.integrationProvider.view,
  handle: { crumb: IntegrationProviderBreadcrumb },
  element: <OneIntegrationProviderPage />,
};

const integrationProviderTeamIndexRoute: RouteObject = {
  path: routeDefinitions.asTeam.integrationProvider.index,
  element: <ManyIntegrationProvidersPage />,
  handle: { crumb: () => 'Integration Providers' },
};

const integrationProviderTeamViewRoute: RouteObject = {
  path: routeDefinitions.asTeam.integrationProvider.view,
  element: <OneIntegrationProviderPage />,
  handle: { crumb: IntegrationProviderBreadcrumb },
};

export const integrationProvidersGlobalRoutes = [
  integrationProvidersGlobalIndexRoute,
  integrationProviderGlobalCreateRoute,
  integrationProviderGlobalViewRoute,
];

export const integrationProvidersTeamRoutes = [
  integrationProviderTeamIndexRoute,
  integrationProviderTeamViewRoute,
];
