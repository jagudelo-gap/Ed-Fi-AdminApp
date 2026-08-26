import { ActionsType, Icons } from '@edanalytics/common-ui';
import { GetUserDto } from '@edanalytics/models';
import { useLocation, useNavigate } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { queryKey, userQueries } from '../../api';
import { globalUserAuthConfig, globalUtmAuthConfig, useAuthorize } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { useQueryClient } from '@tanstack/react-query';

export const useUserGlobalActions = (user: GetUserDto | undefined): ActionsType => {
  const location = useLocation();
  const search = useSearchParamsObject();
  const onApplicationPage = user && location.pathname.endsWith(`/users/${user.id}`);
  const inEdit = onApplicationPage && 'edit' in search && search?.edit === 'true';
  const popBanner = usePopBanner();
  const queryClient = useQueryClient();

  const navigate = useNavigate();
  const to = (id: number | string) => `/users/${id}`;
  const deleteUser = userQueries.delete({});

  const canView = useAuthorize(globalUserAuthConfig('user:read'));
  const canAssign = useAuthorize(globalUtmAuthConfig('user-team-membership:read'));
  const canEdit = useAuthorize(globalUserAuthConfig('user:update'));
  const canDelete = useAuthorize(globalUserAuthConfig('user:delete'));

  return user === undefined
    ? {}
    : {
        ...(canView
          ? {
              View: {
                icon: Icons.View,
                text: 'View',
                title: 'View ' + user.displayName,
                to: to(user.id),
                onClick: () => navigate(to(user.id)),
              },
            }
          : {}),
        ...(canAssign
          ? {
              Assign: {
                icon: Icons.IdCard,
                text: 'Add team',
                title: 'Add ' + user.displayName + ' to a team',
                to: `/user-team-memberships/create?userId=${user.id}`,
                onClick: () => navigate(`/user-team-memberships/create?userId=${user.id}`),
              },
            }
          : {}),
        ...(canEdit
          ? {
              Edit: {
                icon: Icons.Edit,
                isDisabled: inEdit,
                text: 'Edit',
                title: 'Edit ' + user.displayName,
                to: to(user.id) + '?edit=true',
                onClick: () => navigate(to(user.id) + '?edit=true'),
              },
            }
          : {}),
        ...(canDelete
          ? {
              Delete: {
                icon: Icons.Delete,
                isPending: deleteUser.isPending,
                text: 'Delete',
                title: 'Delete user',
                confirmBody: 'This will permanently delete the user.',
                onClick: () =>
                  deleteUser.mutateAsync(
                    { id: user.id },
                    {
                      ...mutationErrCallback({ popGlobalBanner: popBanner }),
                      onSuccess: () => {
                        queryClient.invalidateQueries({
                          queryKey: queryKey({
                            resourceName: 'UserTeamMembership',
                            id: false,
                          }),
                        });
                        navigate(`/users`);
                      },
                    }
                  ),
                confirm: true,
              },
            }
          : {}),
      };
};
