import { ActionsType, Icons } from '@edanalytics/common-ui';
import { useNavigate } from 'react-router';
import { globalOwnershipAuthConfig, useAuthorize } from '../../helpers';

export const useMultipleOwnershipGlobalActions = (): ActionsType => {
  const navigate = useNavigate();
  const canCreate = useAuthorize(globalOwnershipAuthConfig('ownership:create'));

  return canCreate
    ? {
        Create: {
          icon: Icons.Plus,
          text: 'Grant new',
          title: 'Grant new team resource ownership.',
          to: '/ownerships/create',
          onClick: () => navigate('/ownerships/create'),
        },
      }
    : {};
};
