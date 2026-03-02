import {
  OneTimeShareCredentials,
  PageActions,
  PageContentCard,
  PageTemplate,
} from '@edanalytics/common-ui';
import omit from 'lodash/omit';
import { useQuery } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';
import { useParams } from 'react-router-dom';

import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { useSingleApiClientActions } from './useApiClientActions';
import { ViewApiClient } from './ViewApiClient';
import { apiClientQueriesV2 } from '../../api';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { EditApiClient } from './EditApiClient';

export const ApiClientPageV2 = () => {
  return (
    <PageTemplate
      title={
        <ErrorBoundary fallbackRender={() => 'Credentials'}>
          <ApiClientPageTitle />
        </ErrorBoundary>
      }
      actions={<ApiClientPageActions />}
      customPageContentCard
    >
      <PageContentCard>
        <ApiClientPageContent />
      </PageContentCard>
      <OneTimeShareCredentials />
    </PageTemplate>
  );
};

export const ApiClientPageTitle = () => {
  const params = useParams() as {
    apiClientId: string;
  };
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const apiClient = useQuery(
    apiClientQueriesV2.getOne({
      teamId,
      id: params.apiClientId,
      edfiTenant,
    }, {})
  ).data;
  return <>{apiClient?.name || 'Credentials'}</>;
};

export const ApiClientPageContent = () => {
  const params = useParams() as {
    apiClientId: string;
  };
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const apiClient = useQuery(
    apiClientQueriesV2.getOne(
      {
        teamId,
        id: params.apiClientId,
        edfiTenant,
      },
      {}
    )
  ).data;
  const { edit } = useSearchParamsObject((value) => ({
    edit: 'edit' in value && value.edit === 'true',
  }));

  return apiClient ? (edit ? <EditApiClient apiClient={apiClient} /> : <ViewApiClient apiClient={apiClient} />) : null;
};

export const ApiClientPageActions = () => {

    const params = useParams() as {
      applicationId: string;
      apiClientId: string;
    };
    const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
    const apiClient = useQuery(
      apiClientQueriesV2.getOne({
        teamId,
        id: params.apiClientId,
        edfiTenant,
      }, {})
    ).data;
  
    const actions = useSingleApiClientActions({
      apiClient,
      applicationId: Number(params.applicationId),
    });
    return <PageActions actions={omit(actions, 'View')} />;
};