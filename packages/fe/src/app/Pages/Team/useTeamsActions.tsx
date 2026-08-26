import { ActionsType, Icons } from '@edanalytics/common-ui';
import { useNavigate } from 'react-router';
import { globalTeamAuthConfig, useAuthorize } from '../../helpers';

// TODO rename the multi-item versions to something other than just the extra "s", which isn't visible enough.
export const useTeamsActions = (): ActionsType => {
  const navigate = useNavigate();

  const canCreate = useAuthorize(globalTeamAuthConfig('team:create'));

  return canCreate
    ? {
        Create: {
          icon: Icons.Plus,
          text: 'Create new',
          title: 'Create new team.',
          to: '/teams/create',
          onClick: () => navigate('/teams/create'),
        },
      }
    : {};
};
