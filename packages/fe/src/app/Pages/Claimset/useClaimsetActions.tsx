import { ActionsType, Icons } from '@edanalytics/common-ui';
import { GetClaimsetDto } from '@edanalytics/models';
import { RowSelectionState } from '@tanstack/react-table';
import { useNavigate } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { claimsetQueriesV1, API_URL } from '../../api';
import { claimsetAuthConfig, useAuthorize, useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

export const useClaimsetActions = ({
  claimset,
}: {
  claimset: GetClaimsetDto | undefined;
}): ActionsType => {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();

  const navigate = useNavigate();
  const to = (id: number | string) =>
    `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/claimsets/${id}`;
  const deleteClaimset = claimsetQueriesV1.delete({ edfiTenant, teamId: teamId });
  const popBanner = usePopBanner();

  const canView = useAuthorize(
    claimsetAuthConfig(edfiTenant.id, teamId, 'team.sb-environment.edfi-tenant.claimset:read')
  );
  const canEdit =
    useAuthorize(
      claimsetAuthConfig(edfiTenant.id, teamId, 'team.sb-environment.edfi-tenant.claimset:update')
    ) &&
    claimset &&
    !claimset.isSystemReserved;
  const canDelete =
    useAuthorize(
      claimsetAuthConfig(edfiTenant.id, teamId, 'team.sb-environment.edfi-tenant.claimset:delete')
    ) &&
    claimset &&
    !claimset.isSystemReserved;

  return claimset
    ? {
        ...(canView
          ? {
              View: {
                icon: Icons.View,
                text: 'View',
                title: 'View ' + claimset.displayName,
                to: to(claimset.id),
                onClick: () => navigate(to(claimset.id)),
              },
              Export: {
                icon: Icons.Export,
                text: 'Export',
                title: 'Export ' + claimset.displayName,
                onClick: () => {
                  window.open(
                    `${API_URL}/teams/${teamId}/edfi-tenants/${
                      edfiTenant.id
                    }/admin-api/v1/claimsets/export?id=${claimset.id}`,
                    '_blank'
                  );
                },
              },
            }
          : {}),
        ...(canEdit
          ? {
              Edit: {
                icon: Icons.Edit,
                text: 'Edit',
                title: 'Edit ' + claimset.displayName,
                to: to(claimset.id) + '?edit=true',
                onClick: () => navigate(to(claimset.id) + '?edit=true'),
              },
            }
          : {}),
        ...(canDelete
          ? {
              Delete: {
                icon: Icons.Delete,
                isPending: deleteClaimset.isPending,
                text: 'Delete',
                title: 'Delete claimset',
                confirmBody: 'This will permanently delete the claimset.',
                onClick: () =>
                  deleteClaimset.mutateAsync(
                    { id: claimset.id },
                    {
                      ...mutationErrCallback({ popGlobalBanner: popBanner }),
                      onSuccess: () =>
                        navigate(
                          `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/claimsets`
                        ),
                    }
                  ),
                confirm: true,
              },
            }
          : {}),
      }
    : {};
};

export const useManyClaimsetActions = ({
  selectionState,
}: {
  selectionState: RowSelectionState;
}): ActionsType => {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();

  const navigate = useNavigate();
  const toImport = `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/claimsets/import`;
  const canCreate = useAuthorize(
    claimsetAuthConfig(edfiTenant.id, teamId, 'team.sb-environment.edfi-tenant.claimset:create')
  );
  const canRead = useAuthorize(
    claimsetAuthConfig(edfiTenant.id, teamId, 'team.sb-environment.edfi-tenant.claimset:read')
  );

  return {
    ...(canCreate
      ? {
          // Create: {
          //   icon: BiPlus,
          //   text: 'New',
          //   title: 'New claimset',
          //   to: toCreate,
          //   onClick: () => navigate(toCreate),
          // },
          Import: {
            icon: Icons.Import,
            text: 'Import',
            title: 'Import claimsets from Ed-Fi Admin App',
            to: toImport,
            onClick: () => navigate(toImport),
          },
        }
      : {}),
    ...(canRead && Object.keys(selectionState).length > 0
      ? {
          Export: {
            icon: Icons.Export,
            text: 'Export',
            title: 'Export selected claimsets',
            onClick: () => {
              window.open(
                `${API_URL}/teams/${teamId}/edfi-tenants/${
                  edfiTenant.id
                }/admin-api/v1/claimsets/export?id=${Object.keys(selectionState).join('&id=')}`,
                '_blank'
              );
            },
          },
        }
      : {}),
  };
};
