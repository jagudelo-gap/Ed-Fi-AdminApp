import { ActionsType, Icons } from '@edanalytics/common-ui';
import { useNavigate } from 'react-router';
import { globalUtmAuthConfig, useAuthorize } from '../../helpers';

export const useUtmsActionsGlobal = (): ActionsType => {
  const navigate = useNavigate();

  const canCreate = useAuthorize(globalUtmAuthConfig('user-team-membership:create'));
  return canCreate
    ? {
        Create: {
          icon: Icons.Plus,
          text: 'Create new',
          title: 'Create new team membership.',
          to: '/user-team-memberships/create',
          onClick: () => navigate('/user-team-memberships/create'),
        },
      }
    : {};
};
