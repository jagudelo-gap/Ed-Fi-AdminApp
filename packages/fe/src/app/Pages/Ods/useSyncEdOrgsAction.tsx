import { ActionsType, Icons } from '@edanalytics/common-ui';
import { useParams } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { odsQueries } from '../../api';
import {
  teamEdfiTenantAuthConfig,
  useAuthorize,
  useTeamEdfiTenantNavContextLoaded,
} from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

export const useSyncEdOrgsAction = (): ActionsType => {
  const params = useParams() as { odsId: string };
  const { edfiTenant, sbEnvironment, teamId } = useTeamEdfiTenantNavContextLoaded();
  const popBanner = usePopBanner();

  const syncEdOrgs = odsQueries.syncEdOrgs({ edfiTenant, teamId });

  const canSyncEdOrgs =
    useAuthorize(
      teamEdfiTenantAuthConfig(
        '__filtered__',
        edfiTenant?.id,
        teamId,
        'team.sb-environment.edfi-tenant.ods:read'
      )
    ) && !sbEnvironment.startingBlocks && sbEnvironment?.version === 'v2';

  if (!canSyncEdOrgs) {
    return {};
  }

  return {
    SyncEdOrgs: {
      icon: Icons.Refresh,
      text: 'Sync Ed-Orgs',
      title: 'Sync education organizations from Admin API',
      isPending: syncEdOrgs.isPending,
      onClick: () =>
        syncEdOrgs.mutateAsync(
          { entity: {}, pathParams: { odsId: params.odsId } },
          {
            ...mutationErrCallback({ popGlobalBanner: popBanner }),
            onSuccess: () => popBanner({ title: 'Ed-Orgs synced successfully', type: 'Success' }),
          }
        ),
    },
  };
};
