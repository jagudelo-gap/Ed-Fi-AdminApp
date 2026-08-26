import { RouteObject } from 'react-router';
import { OneIntegrationAppPage } from '../Pages/IntegrationApp/OneIntegrationAppPage';
import { IntegrationAppBreadcrumb } from '../Pages/IntegrationApp/IntegrationAppBreadcrumb';
import { routeDefinitions } from './paths';

const integrationAppTeamViewRoute: RouteObject = {
  path: routeDefinitions.asTeam.integrationApp.view,
  element: <OneIntegrationAppPage />,
  handle: { crumb: IntegrationAppBreadcrumb },
};

export const integrationAppsTeamRoutes = [integrationAppTeamViewRoute];
