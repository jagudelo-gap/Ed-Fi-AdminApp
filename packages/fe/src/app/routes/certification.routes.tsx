import { RouteObject } from 'react-router';
import { CertificationPageExecution } from '../Pages/CertificationV2/CertificationPageExecution';
import { RequestCertificationPage as RequestCertificationPageV2 } from '../Pages/CertificationV2/RequestCertificationPage';

export const sbEnvironmentGlobalCertRoute: RouteObject = {
  path: '/sb-environments/:sbEnvironmentId/request-certification',
  element: <RequestCertificationPageV2 />,
};

export const sbEnvironmentGlobalCertExecutionRoute: RouteObject = {
  path: '/sb-environments/:sbEnvironmentId/request-certification/execution',
  element: <CertificationPageExecution />,
};