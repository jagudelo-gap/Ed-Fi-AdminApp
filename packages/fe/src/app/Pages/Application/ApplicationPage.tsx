import { OneTimeShareCredentials, PageActions, PageContentCard, PageTemplate } from '@edanalytics/common-ui';
import omit from 'lodash/omit';
import { ErrorBoundary } from 'react-error-boundary';
import { useParams } from 'react-router';
import { applicationQueriesV1, claimsetQueriesV1 } from '../../api';

import { GetClaimsetDto } from '@edanalytics/models';
import { useQuery } from '@tanstack/react-query';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { EditApplication } from './EditApplication';
import { ViewApplication } from './ViewApplication';
import { useSingleApplicationActions } from './useApplicationActions';

export const ApplicationPage = () => {
  return (
    <PageTemplate
      title={
        <ErrorBoundary fallbackRender={() => 'Application'}>
          <ApplicationPageTitle />
        </ErrorBoundary>
      }
      actions={<ApplicationPageActions />}
      customPageContentCard
    >
      <PageContentCard>
        <ApplicationPageContent />
      </PageContentCard>
      <OneTimeShareCredentials />
    </PageTemplate>
  );
};

export const ApplicationPageTitle = () => {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const params = useParams() as {
    applicationId: string;
  };

  const application = useQuery(
    applicationQueriesV1.getOne({
      id: params.applicationId,
      edfiTenant: edfiTenant,
      teamId: teamId,
    })
  ).data;

  return <>{application?.displayName || 'Application'}</>;
};

export const ApplicationPageContent = () => {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const params = useParams() as {
    edfiTenantId: string;
    asId: string;
    applicationId: string;
  };

  const application = useQuery(
    applicationQueriesV1.getOne({
      id: params.applicationId,
      edfiTenant: edfiTenant,
      teamId: teamId,
    })
  ).data;
  const claimsets = useQuery(
    claimsetQueriesV1.getAll({
      edfiTenant: edfiTenant,
      teamId: teamId,
    })
  );
  const claimsetsByName = Object.values(claimsets.data ?? {}).reduce<
    Record<string, GetClaimsetDto>
  >((map, claimset) => {
    map[claimset.name] = claimset;
    return map;
  }, {});
  const claimset =
    claimsetsByName && application ? claimsetsByName[application.claimSetName] : undefined;

  const { edit } = useSearchParamsObject((value) => ({
    edit: 'edit' in value && value.edit === 'true',
  }));

  return application ? (
    edit && claimsets.isSuccess ? (
      <EditApplication application={application} claimset={claimset} />
    ) : (
      <ViewApplication application={application} />
    )
  ) : null;
};

export const ApplicationPageActions = () => {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const params = useParams() as {
    applicationId: string;
  };

  const application = useQuery(
    applicationQueriesV1.getOne({
      id: params.applicationId,
      edfiTenant: edfiTenant,
      teamId: teamId,
    })
  ).data;

  const actions = useSingleApplicationActions({
    application,
    edfiTenant: edfiTenant,
    teamId: teamId,
  });

  return <PageActions actions={omit(actions, 'View')} />;
};
