import { ActionsType, Icons } from '@edanalytics/common-ui';
import { GetUserTeamMembershipDto } from '@edanalytics/models';
import { useNavigate } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { userTeamMembershipQueries } from '../../api';
import { globalUtmAuthConfig, useAuthorize } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

export const useUtmActionsGlobal = (
  userTeamMembership: GetUserTeamMembershipDto | undefined
): ActionsType => {
  const navigate = useNavigate();
  const popBanner = usePopBanner();
  const to = (id: number | string) => `/user-team-memberships/${id}`;
  const deleteUtm = userTeamMembershipQueries.delete({});

  const canView = useAuthorize(globalUtmAuthConfig('user-team-membership:read'));
  const canEdit = useAuthorize(globalUtmAuthConfig('user-team-membership:update'));
  const canDelete = useAuthorize(globalUtmAuthConfig('user-team-membership:delete'));

  return userTeamMembership === undefined
    ? {}
    : {
        ...(canView
          ? {
              View: {
                icon: Icons.View,
                text: 'View',
                title: 'View ' + userTeamMembership.displayName,
                to: to(userTeamMembership.id),
                onClick: () => navigate(to(userTeamMembership.id)),
              },
            }
          : {}),
        ...(canEdit
          ? {
              Edit: {
                icon: Icons.Edit,
                text: 'Edit',
                title: 'Edit ' + userTeamMembership.displayName,
                to: to(userTeamMembership.id) + '?edit=true',
                onClick: () => navigate(to(userTeamMembership.id) + '?edit=true'),
              },
            }
          : {}),
        ...(canDelete
          ? {
              Delete: {
                icon: Icons.Delete,
                text: 'Delete',
                title: 'Delete team membership',
                confirmBody: 'This will permanently delete the team membership.',
                onClick: () =>
                  deleteUtm.mutateAsync(
                    { id: userTeamMembership.id },
                    {
                      ...mutationErrCallback({ popGlobalBanner: popBanner }),
                      onSuccess: () => navigate(`/user-team-memberships`),
                    }
                  ),
                confirm: true,
              },
            }
          : {}),
      };
};
