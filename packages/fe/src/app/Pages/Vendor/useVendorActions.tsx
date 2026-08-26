import { ActionsType, Icons } from '@edanalytics/common-ui';
import { GetVendorDto } from '@edanalytics/models';
import { useNavigate } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { vendorQueriesV1 } from '../../api';
import { useAuthorize, useTeamEdfiTenantNavContextLoaded, vendorAuthConfig } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

export const useVendorActions = (vendor: GetVendorDto | undefined): ActionsType => {
  const { teamId, edfiTenant, edfiTenantId, asId } = useTeamEdfiTenantNavContextLoaded();
  const navigate = useNavigate();
  const to = (id: number | string) =>
    `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/vendors/${id}`;
  const deleteVendor = vendorQueriesV1.delete({ edfiTenant, teamId });
  const popBanner = usePopBanner();
  const canView = useAuthorize(
    vendorAuthConfig(edfiTenantId, asId, 'team.sb-environment.edfi-tenant.vendor:read')
  );

  const canEdit = useAuthorize(
    vendorAuthConfig(edfiTenantId, asId, 'team.sb-environment.edfi-tenant.vendor:update')
  );

  const canDelete = useAuthorize(
    vendorAuthConfig(edfiTenantId, asId, 'team.sb-environment.edfi-tenant.vendor:delete')
  );

  return vendor === undefined
    ? {}
    : {
        ...(canView
          ? {
              View: {
                icon: Icons.View,
                text: 'View',
                title: 'View ' + vendor.displayName,
                to: to(vendor.id),
                onClick: () => navigate(to(vendor.id)),
              },
            }
          : {}),
        ...(canEdit
          ? {
              Edit: {
                icon: Icons.Edit,
                text: 'Edit',
                title: 'Edit ' + vendor.displayName,
                to: to(vendor.id) + '?edit=true',
                onClick: () => navigate(to(vendor.id) + '?edit=true'),
              },
            }
          : {}),
        ...(canDelete
          ? {
              Delete: {
                icon: Icons.Delete,
                isPending: deleteVendor.isPending,
                text: 'Delete',
                title: 'Delete vendor',
                confirmBody: 'This will permanently delete the vendor.',
                onClick: () =>
                  deleteVendor.mutateAsync(
                    { id: vendor.id },
                    {
                      ...mutationErrCallback({ popGlobalBanner: popBanner }),
                      onSuccess: () =>
                        navigate(
                          `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/vendors`
                        ),
                    }
                  ),
                confirm: true,
              },
            }
          : {}),
      };
};

export const useManyVendorActions = (): ActionsType => {
  const { asId, edfiTenantId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();

  const navigate = useNavigate();
  const to = `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/vendors/create`;
  const canCreate = useAuthorize(
    vendorAuthConfig(edfiTenantId, asId, 'team.sb-environment.edfi-tenant.vendor:create')
  );

  return canCreate
    ? {
        Create: {
          icon: Icons.Plus,
          text: 'New',
          title: 'New vendor',
          to,
          onClick: () => navigate(to),
        },
      }
    : {};
};
