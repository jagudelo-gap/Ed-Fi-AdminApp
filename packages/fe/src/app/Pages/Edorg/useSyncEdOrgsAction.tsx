import { ActionsType, Icons } from '@edanalytics/common-ui';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { edorgQueries } from '../../api';
import {
  teamEdfiTenantAuthConfig,
  useAuthorize,
  useTeamEdfiTenantNavContextLoaded,
} from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

export const useSyncEdOrgsAction = (): ActionsType => {
  const { edfiTenant, sbEnvironment, teamId } = useTeamEdfiTenantNavContextLoaded();
  const popBanner = usePopBanner();

  const syncEdOrgs = edorgQueries.syncEdOrgs({ edfiTenant, teamId });

  const canSyncEdOrgs =
    useAuthorize(
      teamEdfiTenantAuthConfig(
        '__filtered__',
        edfiTenant?.id,
        teamId,
        'team.sb-environment.edfi-tenant.ods.edorg:read'
      )
    ) &&
    (sbEnvironment?.version === 'v2' || sbEnvironment?.version === 'v3') &&
    !sbEnvironment?.startingBlocks;

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
          { entity: {}, pathParams: {} },
          {
            ...mutationErrCallback({ popGlobalBanner: popBanner }),
            onSuccess: () => popBanner({ title: 'Ed-Orgs synced successfully', type: 'Success' }),
          }
        ),
    },
  };
};
