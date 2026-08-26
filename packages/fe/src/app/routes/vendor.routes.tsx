import { Link, Text } from '@chakra-ui/react';
import { GetVendorDto, GetVendorDtoV2 } from '@edanalytics/models';
import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { RouteObject, Link as RouterLink, useParams } from 'react-router';
import { VendorPage } from '../Pages/Vendor/VendorPage';
import { VendorsPage } from '../Pages/Vendor/VendorsPage';
import { vendorQueriesV1, vendorQueriesV2, vendorQueriesV3 } from '../api';
import {
  VersioningHoc,
  getRelationDisplayName,
  useTeamEdfiTenantNavContextLoaded,
  withLoader,
} from '../helpers';
import { getEntityFromQuery } from '../helpers/getEntityFromQuery';
import { CreateVendor } from '../Pages/Vendor/CreateVendorPage';
import { VendorPageV2 } from '../Pages/VendorV2Plus/VendorPage';
import { VendorsPageV2 } from '../Pages/VendorV2Plus/VendorsPage';
import { CreateVendorV2 } from '../Pages/VendorV2Plus/CreateVendorPage';
import { createVersionedResource } from '../api/queries/versioned';

const VendorBreadcrumbV1 = () => {
  const params = useParams() as {
    vendorId: string;
  };
  const { edfiTenant, teamId } = useTeamEdfiTenantNavContextLoaded();
  const vendor = useQuery(
    vendorQueriesV1.getOne({
      id: params.vendorId,
      teamId,
      edfiTenant,
    })
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (vendor.data?.displayName ?? params.vendorId) as any;
};

// v2/v3 breadcrumbs are byte-for-byte identical except which queries module
// they call — the same shape `createVersionedResource` already exists to
// dedupe (see vendorConfig.ts). v1 stays separate, consistent with the rest
// of this file treating v1 as out of scope for that pattern.
const useVendorBreadcrumbQueries = createVersionedResource<{
  version: 'v2' | 'v3';
  getOne: typeof vendorQueriesV2.getOne;
}>({
  v2: { version: 'v2', getOne: vendorQueriesV2.getOne },
  v3: { version: 'v3', getOne: vendorQueriesV3.getOne },
});

const VendorBreadcrumbV2Plus = () => {
  const params = useParams() as {
    vendorId: string;
  };
  const { edfiTenant, teamId } = useTeamEdfiTenantNavContextLoaded();
  const { getOne } = useVendorBreadcrumbQueries();
  const vendor = useQuery(
    getOne({
      id: params.vendorId,
      teamId,
      edfiTenant,
    })
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (vendor.data?.displayName ?? params.vendorId) as any;
};
export const vendorCreateRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/vendors/create',
  element: <VersioningHoc v1={<CreateVendor />} v2={<CreateVendorV2 />} v3={<CreateVendorV2 />} />,
  handle: { crumb: () => 'Create Vendor' },
};
export const vendorIndexRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/vendors/:vendorId/',
  element: <VersioningHoc v1={<VendorPage />} v2={<VendorPageV2 />} v3={<VendorPageV2 />} />,
};

export const vendorRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/vendors/:vendorId',
  handle: {
    crumb: withLoader(() => (
      <VersioningHoc
        v1={<VendorBreadcrumbV1 />}
        v2={<VendorBreadcrumbV2Plus />}
        v3={<VendorBreadcrumbV2Plus />}
      />
    )),
  },
};
export const vendorsIndexRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/vendors/',
  element: <VersioningHoc v1={<VendorsPage />} v2={<VendorsPageV2 />} v3={<VendorsPageV2 />} />,
};
export const vendorsRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/vendors',
  handle: { crumb: () => 'Vendors' },
};

export const VendorLinkV1 = (props: {
  id: number | undefined;
  query: UseQueryResult<Record<string | number, GetVendorDto>, unknown>;
}) => {
  const vendor = getEntityFromQuery(props.id, props.query);
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();

  return vendor ? (
    <Link as="span">
      <RouterLink
        title="Go to vendor"
        to={`/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/vendors/${vendor.id}`}
      >
        {getRelationDisplayName(props.id, props.query)}
      </RouterLink>
    </Link>
  ) : typeof props.id === 'number' ? (
    <Text title="Vendor may have been deleted, or you lack access." as="i" color="gray.500">
      can't find &#8220;{props.id}&#8221;
    </Text>
  ) : null;
};
export const VendorLinkV2 = (props: {
  id: number | undefined;
  query: UseQueryResult<Record<string | number, GetVendorDtoV2>, unknown>;
}) => {
  const vendor = getEntityFromQuery(props.id, props.query);
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();

  return vendor ? (
    <Link as="span">
      <RouterLink
        title="Go to vendor"
        to={`/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/vendors/${vendor.id}`}
      >
        {getRelationDisplayName(props.id, props.query)}
      </RouterLink>
    </Link>
  ) : typeof props.id === 'number' ? (
    <Text title="Vendor may have been deleted, or you lack access." as="i" color="gray.500">
      can't find &#8220;{props.id}&#8221;
    </Text>
  ) : null;
};
