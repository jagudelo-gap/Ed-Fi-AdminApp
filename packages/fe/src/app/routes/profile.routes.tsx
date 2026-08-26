import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { RouteObject, Link as RouterLink, useParams } from 'react-router';
import {
  getEntityFromQuery,
  getRelationDisplayName,
  useTeamEdfiTenantNavContextLoaded,
  withLoader,
  VersioningHoc,
} from '../helpers';
import { Link, Text } from '@chakra-ui/react';
import { profileQueriesV2, profileQueriesV3 } from '../api/queries/queries.v7';
import { ProfilesPage } from '../Pages/ProfileV2Plus/ProfilesPage';
import { ProfilePageV2 } from '../Pages/ProfileV2Plus/ProfilePage';
import { CreateProfile } from '../Pages/ProfileV2Plus/CreateProfilePage';
import type { ProfileEntity } from '../Pages/ProfileV2Plus/profileConfig';
import { createVersionedResource } from '../api/queries/versioned';

// v2/v3 breadcrumbs are byte-for-byte identical except which queries module
// they call — same dedup shape as vendor.routes.tsx's
// useVendorBreadcrumbQueries. There is no v1 Profile breadcrumb to keep
// separate (unlike Vendor) — v1 never supported Profiles at all.
const useProfileBreadcrumbQueries = createVersionedResource<{
  version: 'v2' | 'v3';
  getOne: typeof profileQueriesV2.getOne;
}>({
  v2: { version: 'v2', getOne: profileQueriesV2.getOne },
  v3: { version: 'v3', getOne: profileQueriesV3.getOne },
});

const ProfileBreadcrumb = () => {
  const params = useParams() as {
    profileId: string;
  };
  const { edfiTenant, teamId } = useTeamEdfiTenantNavContextLoaded();
  const { getOne } = useProfileBreadcrumbQueries();
  const profile = useQuery(
    getOne({
      id: params.profileId,
      teamId,
      edfiTenant,
    })
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (profile.data?.name ?? params.profileId) as any;
};
export const profileCreateRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/profiles/create',
  element: <VersioningHoc v2={<CreateProfile />} v3={<CreateProfile />} />,
  handle: { crumb: () => 'Create Profile' },
};
export const profileIndexRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/profiles/:profileId/',
  element: <VersioningHoc v2={<ProfilePageV2 />} v3={<ProfilePageV2 />} />,
};

export const profileRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/profiles/:profileId',
  handle: {
    crumb: withLoader(() => <VersioningHoc v2={<ProfileBreadcrumb />} v3={<ProfileBreadcrumb />} />),
  },
};
export const profilesIndexRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/profiles/',
  element: <VersioningHoc v2={<ProfilesPage />} v3={<ProfilesPage />} />,
};
export const profilesRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/profiles',
  handle: { crumb: () => 'Profiles' },
};
export const ProfileLink = (props: {
  id: number | undefined;
  query: UseQueryResult<Record<string | number, ProfileEntity>, unknown>;
}) => {
  const profile = getEntityFromQuery(props.id, props.query);
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();

  return profile ? (
    <Link as="span">
      <RouterLink
        title="Go to profile"
        to={`/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/profiles/${profile.id}`}
      >
        {getRelationDisplayName(props.id, props.query)}
      </RouterLink>
    </Link>
  ) : typeof props.id === 'number' ? (
    <Text title="Profile may have been deleted, or you lack access." as="i" color="gray.500">
      can't find &#8220;{props.id}&#8221;
    </Text>
  ) : null;
};
