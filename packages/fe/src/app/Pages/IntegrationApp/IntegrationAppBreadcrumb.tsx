import { useParams } from 'react-router';
import { useGetOneIntegrationApp } from '../../api-v2';

export const IntegrationAppBreadcrumb = () => {
  const { integrationAppId, integrationProviderId } = useParams() as {
    integrationAppId: string;
    integrationProviderId: string;
  };
  const integrationApp = useGetOneIntegrationApp({
    queryArgs: { integrationAppId, integrationProviderId },
  }).data;
  return integrationApp?.applicationName ?? integrationAppId;
};
