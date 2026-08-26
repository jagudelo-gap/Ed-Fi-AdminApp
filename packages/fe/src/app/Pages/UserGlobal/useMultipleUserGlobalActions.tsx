import { ActionsType, Icons } from '@edanalytics/common-ui';
import { useNavigate } from 'react-router';
import { globalUserAuthConfig, useAuthorize } from '../../helpers';

export const useMultipleUserGlobalActions = (): ActionsType => {
  const navigate = useNavigate();

  const canCreate = useAuthorize(globalUserAuthConfig('user:create'));

  return canCreate
    ? {
        Create: {
          icon: Icons.Plus,
          text: 'Create new',
          title: 'Create new application user.',
          to: '/users/create',
          onClick: () => navigate('/users/create'),
        },
      }
    : {};
};
