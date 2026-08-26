import { ActionsType, Icons } from '@edanalytics/common-ui';
import { useNavigate } from 'react-router';
import { globalRoleAuthConfig, useAuthorize } from '../../helpers';

export const useMultipleRoleGlobalActions = (): ActionsType => {
  const navigate = useNavigate();

  const canCreate = useAuthorize(globalRoleAuthConfig('__filtered__', 'role:create'));
  return canCreate
    ? {
        Create: {
          icon: Icons.Plus,
          text: 'Create new',
          title: 'Create new user or ownership role.',
          to: '/roles/create',
          onClick: () => navigate('/roles/create'),
        },
      }
    : {};
};
