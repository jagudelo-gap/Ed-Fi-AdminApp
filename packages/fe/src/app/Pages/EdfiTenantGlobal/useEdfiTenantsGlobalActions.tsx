import { ActionsType, Icons } from '@edanalytics/common-ui';
import { useNavigate } from 'react-router';
import {
  globalEdfiTenantAuthConfig,
  useAuthorize,
  useSbEnvironmentNavContextLoaded,
} from '../../helpers';

export const useEdfiTenantsGlobalActions = (): ActionsType => {
  const { sbEnvironmentId, sbEnvironment } = useSbEnvironmentNavContextLoaded();
  const navigate = useNavigate();

  const canCreate = useAuthorize(
    globalEdfiTenantAuthConfig('__filtered__', 'sb-environment.edfi-tenant:create')
  );

  return canCreate && sbEnvironment.startingBlocks ? {
      Create: {
        icon: Icons.Plus,
        text: 'Create',
        title: 'Create new tenant.',
        to: `/sb-environments/${sbEnvironmentId}/edfi-tenants/create`,
          onClick: () => navigate(`/sb-environments/${sbEnvironmentId}/edfi-tenants/create`),
        },
      }
    : {};
};
