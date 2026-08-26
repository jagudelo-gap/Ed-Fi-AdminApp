import { PageActions, PageTemplate } from '@edanalytics/common-ui';
import omit from 'lodash/omit';
import { useParams } from 'react-router';
import { useGetOneIntegrationProvider } from '../../api-v2';
import { ViewIntegrationProvider } from './ViewIntegrationProvider';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { useOneIntegrationProviderGlobalActions } from './useOneIntegrationProviderGlobalActions';
import { EditIntegrationProviderPage } from './EditIntegrationProviderPage';

export const OneIntegrationProviderPage = () => {
  const { integrationProviderId } = useParams() as { integrationProviderId: string };
  const { edit } = useSearchParamsObject() as { edit?: boolean };

  const integrationProvider = useGetOneIntegrationProvider({
    queryArgs: { integrationProviderId },
  }).data;

  const actions = useOneIntegrationProviderGlobalActions(integrationProvider);

  if (!integrationProvider) return null;

  return (
    <PageTemplate
      title={integrationProvider?.name || 'Integration Provider'}
      actions={<PageActions actions={omit(actions, 'View')} />}
      customPageContentCard
    >
      {edit ? <EditIntegrationProviderPage /> : <ViewIntegrationProvider />}
    </PageTemplate>
  );
};
