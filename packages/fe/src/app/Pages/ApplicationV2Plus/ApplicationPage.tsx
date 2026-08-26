import {
  OneTimeShareCredentials,
  PageActions,
  PageContentCard,
  PageTemplate,
} from '@edanalytics/common-ui';
import omit from 'lodash/omit';
import { ErrorBoundary } from 'react-error-boundary';
import { useParams } from 'react-router';

import { GetApplicationDtoV2, GetApplicationDtoV3 } from '@edanalytics/models';
import { UseQueryOptions, useQuery } from '@tanstack/react-query';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { EditApplication } from './EditApplication';
import { ViewApplication } from './ViewApplication';
import { useSingleApplicationActions } from './useApplicationActions';
import { useGetOneApplication } from '../../api-v2';
import { ApplicationEntity, getDataStoreIds, useApplicationConfig } from './applicationConfig';
import { ClaimsetEntity, useClaimsetConfig } from '../ClaimsetV2Plus/claimsetConfig';

// V2 tenants keep using the hardcoded-v2-URL hook (unchanged); v3 tenants
// fetch through the versioned query builder instead. Only one of these two
// is ever actually enabled/fetching for a given tenant.
const useApplicationDetail = (applicationId: number) => {
  const { edfiTenantId, asId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const { version, queries } = useApplicationConfig();

  const v2Query = useGetOneApplication({
    queryArgs: {
      applicationId,
      edfiTenantId,
      teamId: asId,
      getIntegrationAppDetails: true,
    },
    enabled: version === 'v2',
  });
  // TypeScript cannot resolve union-typed overloaded functions; cast to the
  // actual return type (same pattern as ApplicationsPage.tsx / ClaimsetsPage.tsx / ProfilesPage.tsx).
  const v3Query = useQuery({
    ...(queries.getOne({ id: applicationId, edfiTenant, teamId: asId }) as unknown as UseQueryOptions<ApplicationEntity>),
    enabled: version === 'v3',
  });

  return version === 'v2'
    ? { data: v2Query.data as ApplicationEntity | undefined, version }
    : { data: v3Query.data as ApplicationEntity | undefined, version };
};

export const ApplicationPageV2 = () => {
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
  const { applicationId } = useParams();

  const { data: application } = useApplicationDetail(Number(applicationId));

  return <>{application?.applicationName || 'Application'}</>;
};

export const ApplicationPageContent = () => {
  const { asId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const params = useParams() as {
    edfiTenantId: string;
    asId: string;
    applicationId: string;
  };

  const { data: application, version } = useApplicationDetail(Number(params.applicationId));

  const { queries: claimsetQueries } = useClaimsetConfig();
  // TypeScript cannot resolve union-typed overloaded functions; cast to the
  // actual return type (same pattern as ClaimsetsPage.tsx / ClaimsetPage.tsx).
  const claimsets = useQuery(
    claimsetQueries.getAll({
      edfiTenant: edfiTenant,
      teamId: asId,
    }) as UseQueryOptions<Record<string | number, ClaimsetEntity>>
  );
  const claimsetsByName = Object.values(claimsets.data ?? {}).reduce<Record<string, ClaimsetEntity>>(
    (map, claimset) => {
      map[claimset.name] = claimset;
      return map;
    },
    {}
  );
  const claimset =
    claimsetsByName && application ? claimsetsByName[application.claimSetName] : undefined;

  const { edit } = useSearchParamsObject((value) => ({
    edit: 'edit' in value && value.edit === 'true',
  }));

  const dataStoreIds = application ? getDataStoreIds(application) : [];

  const url =
    application && edfiTenant?.sbEnvironment.domain
      ? version === 'v2'
        ? GetApplicationDtoV2.apiUrl(
            edfiTenant.sbEnvironment.startingBlocks,
            edfiTenant.sbEnvironment.domain,
            application.applicationName,
            edfiTenant.name
          )
        : GetApplicationDtoV3.apiUrl(
            edfiTenant.sbEnvironment.startingBlocks,
            edfiTenant.sbEnvironment.domain,
            application.applicationName,
            edfiTenant.name
          )
      : undefined;

  return application ? (
    edit ? (
      claimsets.isSuccess ? (
        <EditApplication application={application} claimset={claimset} />
      ) : null
    ) : (
      <ViewApplication application={application} dataStoreIds={dataStoreIds} url={url} />
    )
  ) : null;
};

export const ApplicationPageActions = () => {
  const params = useParams() as {
    edfiTenantId: string;
    asId: string;
    applicationId: string;
  };

  const { data: application } = useApplicationDetail(Number(params.applicationId));

  const actions = useSingleApplicationActions({
    application,
  });

  return <PageActions actions={omit(actions, 'View')} />;
};
