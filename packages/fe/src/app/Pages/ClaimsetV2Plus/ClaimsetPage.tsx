import { PageActions, PageTemplate, ResourceClaimsTableV2, ResourceClaimsTableV3 } from '@edanalytics/common-ui';
import { GetClaimsetSingleDtoV2, GetClaimsetSingleDtoV3 } from '@edanalytics/models';
import { UseQueryOptions, useQuery } from '@tanstack/react-query';
import omit from 'lodash/omit';
import { ComponentType, Suspense, lazy } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useParams } from 'react-router';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { useClaimsetConfig } from './claimsetConfig';
import { useClaimsetActions } from './useClaimsetActions';
const ViewClaimset = lazy(() => import('./ViewClaimset'));

// React.lazy's signature (`lazy<T extends ComponentType<any>>`) can't preserve
// a generic component's type parameter — TypeScript collapses ViewClaimset's
// `D` to its constraint bound (GetClaimsetSingleDtoV2 | GetClaimsetSingleDtoV3)
// once it's wrapped in lazy(). These two aliases re-pin each branch's concrete
// instantiation so the .match() branches below can pass the matching
// ResourceClaimsTableV2/V3 without a type error.
const ViewClaimsetV2 = ViewClaimset as ComponentType<{
  claimset: GetClaimsetSingleDtoV2;
  ResourceClaimsTable: ComponentType<{ claimset: GetClaimsetSingleDtoV2 }>;
}>;
const ViewClaimsetV3 = ViewClaimset as ComponentType<{
  claimset: GetClaimsetSingleDtoV3;
  ResourceClaimsTable: ComponentType<{ claimset: GetClaimsetSingleDtoV3 }>;
}>;

export const ClaimsetPageV2 = () => {
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
  const { queries } = useClaimsetConfig();
  // TypeScript cannot resolve union-typed overloaded functions; cast to the
  // actual return type. Same workaround as ClaimsetsPage.tsx/NameCell.tsx.
  const claimset = useQuery(
    queries.getOne({
      id: params.claimsetId,
      edfiTenant,
      teamId,
    }) as UseQueryOptions<GetClaimsetSingleDtoV2 | GetClaimsetSingleDtoV3>
  ).data;

  return <>{claimset?.displayName || 'Claimset'}</>;
};

// The resource-claims tree genuinely diverges in shape between V2/V3 (flat
// parentClaimName-joined list vs. nested children — see 530-design.md), so
// this dispatches via `.match()` to pair the right query, DTO, and table
// component together, even though it's a read path.
export const ClaimsetPageContent = () => {
  const params = useParams() as {
    claimsetId: string;
  };
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const { edit } = useSearchParamsObject() as { edit?: boolean };

  return useClaimsetConfig.match({
    v2: ({ queries }) => {
      const claimset = useQuery(queries.getOne({ id: params.claimsetId, edfiTenant, teamId })).data;
      return claimset ? (
        edit ? (
          <>Not implemented</>
        ) : (
          <Suspense fallback={<div>Loading...</div>}>
            <ViewClaimsetV2 claimset={claimset} ResourceClaimsTable={ResourceClaimsTableV2} />
          </Suspense>
        )
      ) : null;
    },
    v3: ({ queries }) => {
      const claimset = useQuery(queries.getOne({ id: params.claimsetId, edfiTenant, teamId })).data;
      return claimset ? (
        edit ? (
          <>Not implemented</>
        ) : (
          <Suspense fallback={<div>Loading...</div>}>
            <ViewClaimsetV3 claimset={claimset} ResourceClaimsTable={ResourceClaimsTableV3} />
          </Suspense>
        )
      ) : null;
    },
  });
};
export const ClaimsetPageActions = () => {
  const params = useParams() as {
    claimsetId: string;
  };
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const { queries } = useClaimsetConfig();
  // TypeScript cannot resolve union-typed overloaded functions; cast to the
  // actual return type. Same workaround as ClaimsetsPage.tsx/NameCell.tsx.
  const claimset = useQuery(
    queries.getOne({
      id: params.claimsetId,
      edfiTenant,
      teamId,
    }) as UseQueryOptions<GetClaimsetSingleDtoV2 | GetClaimsetSingleDtoV3>
  ).data;

  const actions = useClaimsetActions({
    claimset,
  });

  return <PageActions actions={omit(actions, 'View')} />;
};
