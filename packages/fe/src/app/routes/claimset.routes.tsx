import { Link, Text } from '@chakra-ui/react';
import {
  GetClaimsetDto,
  GetClaimsetMultipleDtoV2,
  GetClaimsetMultipleDtoV3,
  GetClaimsetSingleDtoV2,
  GetClaimsetSingleDtoV3,
} from '@edanalytics/models';
import { UseQueryOptions, UseQueryResult, useQuery } from '@tanstack/react-query';
import { RouteObject, Link as RouterLink, useParams } from 'react-router';
import { ClaimsetPage } from '../Pages/Claimset/ClaimsetPage';
import { ClaimsetsPage } from '../Pages/Claimset/ClaimsetsPage';
import { CreateClaimset } from '../Pages/Claimset/CreateClaimsetPage';
import { ImportClaimsetsPage } from '../Pages/Claimset/ImportClaimsetsPage';
import { ClaimsetPageV2 } from '../Pages/ClaimsetV2Plus/ClaimsetPage';
import { ClaimsetsPageV2 } from '../Pages/ClaimsetV2Plus/ClaimsetsPage';
import { CopyClaimsetPage } from '../Pages/ClaimsetV2Plus/CopyClaimset';
import { ImportClaimsetsPageV2 } from '../Pages/ClaimsetV2Plus/ImportClaimsetsPage';
import { ImportClaimsetsPageV3 } from '../Pages/ClaimsetV2Plus/ImportClaimsetsPageV3';
import { useClaimsetConfig } from '../Pages/ClaimsetV2Plus/claimsetConfig';
import { claimsetQueriesV1 } from '../api';
import { getRelationDisplayName, useTeamEdfiTenantNavContextLoaded, withLoader } from '../helpers';
import { VersioningHoc } from '../helpers/VersioningHoc';
import { getEntityFromQuery } from '../helpers/getEntityFromQuery';

const ClaimsetBreadcrumbV1 = () => {
  const params = useParams() as { claimsetId: string };
  const { edfiTenant, teamId } = useTeamEdfiTenantNavContextLoaded();
  const claimset = useQuery(
    claimsetQueriesV1.getOne({
      id: params.claimsetId,
      teamId,
      edfiTenant,
    })
  );
  return claimset.data?.displayName ?? params.claimsetId;
};

const ClaimsetBreadcrumbV2Plus = () => {
  const params = useParams() as {
    claimsetId: string;
  };
  const { edfiTenant, asId: teamId } = useTeamEdfiTenantNavContextLoaded();
  const { queries } = useClaimsetConfig();
  const claimset = useQuery(
    // Same established TS2769 workaround as ClaimsetPage.tsx's ClaimsetPageTitle:
    // `queries` is union-typed from the plain hook, and TypeScript can't resolve
    // a union-typed overloaded call through useQuery. Cast to the concrete
    // return type — the breadcrumb only reads `.displayName`, present on both.
    queries.getOne({
      id: params.claimsetId,
      edfiTenant,
      teamId,
    }) as UseQueryOptions<GetClaimsetSingleDtoV2 | GetClaimsetSingleDtoV3>
  );
  return claimset.data?.displayName ?? params.claimsetId;
};
export const claimsetCreateRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/claimsets/create',
  element: <CreateClaimset />,
  handle: { crumb: () => 'Create Claimset' },
};
export const claimsetCopyRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/claimsets/:claimsetId/copy',
  element: <VersioningHoc v2={<CopyClaimsetPage />} v3={<CopyClaimsetPage />} />,
  handle: { crumb: () => 'Copy' },
};
export const claimsetImportRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/claimsets/import',
  element: (
    <VersioningHoc
      v1={<ImportClaimsetsPage />}
      v2={<ImportClaimsetsPageV2 />}
      v3={<ImportClaimsetsPageV3 />}
    />
  ),
  handle: { crumb: () => 'Import Claimsets' },
};
export const claimsetIndexRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/claimsets/:claimsetId/',
  element: <VersioningHoc v1={<ClaimsetPage />} v2={<ClaimsetPageV2 />} v3={<ClaimsetPageV2 />} />,
};

export const claimsetRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/claimsets/:claimsetId',
  handle: {
    crumb: withLoader(() => (
      <VersioningHoc
        v1={<ClaimsetBreadcrumbV1 />}
        v2={<ClaimsetBreadcrumbV2Plus />}
        v3={<ClaimsetBreadcrumbV2Plus />}
      />
    )),
    fallbackCrumb: () => 'Claimset',
  },
};
export const claimsetsIndexRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/claimsets/',
  element: <VersioningHoc v1={<ClaimsetsPage />} v2={<ClaimsetsPageV2 />} v3={<ClaimsetsPageV2 />} />,
};
export const claimsetsRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/claimsets',
  handle: { crumb: () => 'Claimsets' },
};

export const ClaimsetLinkV1 = (props: {
  id: number | string | undefined;
  query: Pick<UseQueryResult<Record<string | number, GetClaimsetDto>, unknown>, 'data'>;
}) => {
  const claimset = getEntityFromQuery(props.id, props.query);
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();

  return claimset ? (
    <Link as="span">
      <RouterLink
        title="Go to claimset"
        to={`/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/claimsets/${claimset.id}`}
      >
        {getRelationDisplayName(props.id, props.query)}
      </RouterLink>
    </Link>
  ) : props.id !== null && props.id !== undefined ? (
    <Text title="Claimset may have been deleted, or you lack access." as="i" color="gray.500">
      can't find &#8220;{props.id}&#8221;
    </Text>
  ) : null;
};
export const ClaimsetLinkV2 = (props: {
  id: number | string | undefined;
  query: Pick<
    UseQueryResult<Record<string | number, GetClaimsetMultipleDtoV2 | GetClaimsetMultipleDtoV3>, unknown>,
    'data'
  >;
}) => {
  const claimset = getEntityFromQuery(props.id, props.query);
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();

  return claimset ? (
    <Link as="span">
      <RouterLink
        title="Go to claimset"
        to={`/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/claimsets/${claimset.id}`}
      >
        {getRelationDisplayName(props.id, props.query)}
      </RouterLink>
    </Link>
  ) : props.id !== null && props.id !== undefined ? (
    <Text title="Claimset may have been deleted, or you lack access." as="i" color="gray.500">
      can't find &#8220;{props.id}&#8221;
    </Text>
  ) : null;
};
