import { ActionsType, Icons } from '@edanalytics/common-ui';
import { useNavigate } from 'react-router';
import { globalSbEnvironmentAuthConfig, useAuthorize } from '../../helpers';

export const useSbEnvironmentsGlobalActions = (): ActionsType => {
  const navigate = useNavigate();

  const canCreate = useAuthorize(
    globalSbEnvironmentAuthConfig('__filtered__', 'sb-environment:create')
  );

  return canCreate
    ? {
        Create: {
          icon: Icons.Plus,
          text: 'Connect',
          title: 'Connect new environment.',
          to: '/sb-environments/create',
          onClick: () => navigate('/sb-environments/create'),
        },
      }
    : {};
};
