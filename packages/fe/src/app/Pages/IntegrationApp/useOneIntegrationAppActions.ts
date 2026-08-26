import { GetIntegrationAppDto } from '@edanalytics/models';
import { ActionsType, Icons } from '@edanalytics/common-ui';
import { useNavigate } from 'react-router';
import { usePaths } from '../../routes/paths';
import { useResetIntegrationAppCredentials } from '../../api-v2';
import { useAuthorize, useTeamNavContext } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { usePopBanner } from '../../Layout/FeedbackBanner';

export function useOneIntegrationAppActions(
  integrationApp: GetIntegrationAppDto | undefined
): ActionsType {
  const paths = usePaths();
  const { asId: asTeamId } = useTeamNavContext();
  const navigate = useNavigate();
  const popGlobalBanner = usePopBanner();

  const canView = useAuthorize(
    integrationApp && integrationApp.applicationId
      ? {
          privilege: 'team.integration-provider.application:read',
          subject: {
            id: integrationApp.integrationProviderId,
            teamId: asTeamId,
          },
        }
      : undefined
  );

  const canReset = useAuthorize(
    integrationApp && integrationApp.applicationId
      ? {
          privilege: 'team.integration-provider.application:reset-credentials',
          subject: {
            id: integrationApp.integrationProviderId,
            teamId: asTeamId,
          },
        }
      : undefined
  );

  const { mutateAsync: resetCredentials, isPending } = useResetIntegrationAppCredentials();

  if (!integrationApp) return {};

  const { id: integrationAppId, integrationProviderId, applicationName } = integrationApp;
  const viewAction: ActionsType = canView
    ? {
        View: {
          icon: Icons.View,
          text: 'View',
          title: 'View ' + applicationName,
          to: paths.integrationApp.view({ integrationAppId, integrationProviderId }),
          onClick: () =>
            navigate(paths.integrationApp.view({ integrationAppId, integrationProviderId })),
        },
      }
    : {};

  const onResetClick = () => {
    resetCredentials(
      { integrationAppId, integrationProviderId },
      {
        ...mutationErrCallback({ popGlobalBanner }),
        onSuccess: (result) => {
          navigate(paths.integrationApp.view({ integrationAppId, integrationProviderId }), {
            state: result.link,
          });
        },
      }
    );
  };
  const resetAction: ActionsType = canReset
    ? {
        Reset: {
          isPending,
          icon: Icons.ShieldX,
          text: 'Reset credentials',
          title: 'Reset integration application credentials',
          onClick: onResetClick,
          confirm: true,
          confirmBody:
            'Are you sure you want to reset the credentials for this integration application? Anything using the current ones will stop working.',
        },
      }
    : {};

  return {
    ...resetAction,
    ...viewAction,
  };
}
