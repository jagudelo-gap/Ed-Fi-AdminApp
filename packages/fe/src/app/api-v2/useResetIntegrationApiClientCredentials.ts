import { apiClientQueriesV2 } from '../api';
import { useTeamEdfiTenantNavContextLoaded } from '../helpers';

export const useResetIntegrationApiClientCredentials = () => {
  const { asId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();

  return apiClientQueriesV2.resetCreds({
    edfiTenant,
    teamId: asId,
  });
};
