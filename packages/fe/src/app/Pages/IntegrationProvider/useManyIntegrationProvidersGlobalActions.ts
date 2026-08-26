import { useNavigate } from 'react-router';
import { ActionsType, Icons } from '@edanalytics/common-ui';
import { usePaths } from '../../routes/paths';
import { globalUserAuthConfig, useAuthorize, useNavContext } from '../../helpers';

export const useManyIntegrationProvidersGlobalActions = (): ActionsType => {
  const paths = usePaths();
  const navigate = useNavigate();

  const { asId: teamId } = useNavContext();
  const inTeamScope = !!teamId;

  const canCreate =
    useAuthorize(globalUserAuthConfig('integration-provider:create')) && !inTeamScope;

  const createAction: ActionsType = canCreate
    ? {
        Create: {
          icon: Icons.Plus,
          text: 'Create new',
          title: 'Create new integration provider.',
          to: paths.integrationProvider.create(),
          onClick: () => navigate(paths.integrationProvider.create()),
        },
      }
    : {};

  return {
    ...createAction,
  };
};
