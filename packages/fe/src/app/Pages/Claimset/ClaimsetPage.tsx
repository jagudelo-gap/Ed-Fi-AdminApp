import { PageActions, PageTemplate } from '@edanalytics/common-ui';
import { useQuery } from '@tanstack/react-query';
import omit from 'lodash/omit';
import { Suspense, lazy } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useParams } from 'react-router';
import { claimsetQueriesV1 } from '../../api';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { EditClaimset } from './EditClaimset';
import { useClaimsetActions } from './useClaimsetActions';
const ViewClaimset = lazy(() => import('./ViewClaimset'));

export const ClaimsetPage = () => {
  return (
    <PageTemplate
      title={
        <ErrorBoundary fallbackRender={() => 'Claimset'}>
          <ClaimsetPageTitle />
        </ErrorBoundary>
      }
      actions={<ClaimsetPageActions />}
    >
      <ClaimsetPageContent />
    </PageTemplate>
  );
};

export const ClaimsetPageTitle = () => {
  const params = useParams() as {
    claimsetId: string;
  };
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const claimset = useQuery(
    claimsetQueriesV1.getOne({
      id: params.claimsetId,
      edfiTenant,
      teamId,
    })
  ).data;

  return <>{claimset?.displayName || 'Claimset'}</>;
};

export const ClaimsetPageContent = () => {
  const params = useParams() as { claimsetId: string };
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const claimset = useQuery(
    claimsetQueriesV1.getOne({
      id: params.claimsetId,
      edfiTenant,
      teamId,
    })
  ).data;
  const { edit } = useSearchParamsObject() as { edit?: boolean };

  return claimset ? (
    edit ? (
      <EditClaimset claimset={claimset} />
    ) : (
      <Suspense fallback={<div>Loading...</div>}>
        <ViewClaimset />
      </Suspense>
    )
  ) : null;
};
export const ClaimsetPageActions = () => {
  const params = useParams() as {
    claimsetId: string;
  };
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const claimset = useQuery(
    claimsetQueriesV1.getOne({
      id: params.claimsetId,
      edfiTenant,
      teamId,
    })
  ).data;

  const actions = useClaimsetActions({
    claimset,
  });

  return <PageActions actions={omit(actions, 'View')} />;
};
