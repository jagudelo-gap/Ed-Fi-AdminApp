import { ActionsType, Icons } from '@edanalytics/common-ui';
import { GetEdfiTenantDto } from '@edanalytics/models';
import { useNavigate, useParams } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { edfiTenantQueries } from '../../api';
import { teamBaseAuthConfig, useAuthorize, useTeamSbEnvironmentNavContext } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

export const useEdfiTenantActions = (edfiTenant: GetEdfiTenantDto | undefined): ActionsType => {
  const popBanner = usePopBanner();
  const navigate = useNavigate();
  const { sbEnvironmentId, teamId } = useTeamSbEnvironmentNavContext();
  const { edfiTenantId } = useParams();
  const deleteTenant = edfiTenantQueries.delete({ sbEnvironmentId, teamId });

  const canDelete = useAuthorize(
    teamBaseAuthConfig(sbEnvironmentId, teamId, 'team.sb-environment:delete-tenant')
  );
  return edfiTenant
    ? {
        View: {
          icon: Icons.View,
          text: 'View',
          title: 'View ' + edfiTenant.displayName,
          to: `/as/${teamId}/sb-environments/${sbEnvironmentId}/edfi-tenants/${edfiTenant.id}`,
          onClick: () =>
            navigate(
              `/as/${teamId}/sb-environments/${sbEnvironmentId}/edfi-tenants/${edfiTenant.id}`
            ),
        },
        ...(canDelete
          ? {
              Delete: {
                icon: Icons.Delete,
                isPending: deleteTenant.isPending,
                text: 'Delete',
                title: 'Delete tenant',
                confirmBody: 'This will permanently delete the tenant.',
                onClick: () =>
                  deleteTenant.mutateAsync(
                    { id: edfiTenant.id },
                    {
                      ...mutationErrCallback({ popGlobalBanner: popBanner }),
                      onSuccess: () =>
                        edfiTenantId !== undefined &&
                        navigate(`/as/${teamId}/sb-environments/${sbEnvironmentId}/edfi-tenants`),
                    }
                  ),
                confirm: true,
              },
            }
          : {}),
      }
    : {};
};
