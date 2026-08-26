import { ActionsType, Icons } from '@edanalytics/common-ui';
import { useNavigate, useParams } from 'react-router';
import { teamBaseAuthConfig, useAuthorize, useTeamSbEnvironmentNavContext } from '../../helpers';

export const useEdfiTenantsActions = (): ActionsType => {
  const navigate = useNavigate();
  const { sbEnvironmentId, teamId } = useTeamSbEnvironmentNavContext();

  const { edfiTenantId } = useParams();

  const canPost = useAuthorize(
    teamBaseAuthConfig(sbEnvironmentId, teamId, 'team.sb-environment:create-tenant')
  );
  return canPost
    ? {
        Create: {
          icon: Icons.Plus,
          text: 'Create',
          title: 'Create new tenant.',
          to: `/as/${teamId}/sb-environments/${sbEnvironmentId}/edfi-tenants/create`,
          onClick: () =>
            edfiTenantId !== undefined &&
            navigate(`/as/${teamId}/sb-environments/${sbEnvironmentId}/edfi-tenants/create`),
        },
      }
    : {};
};
