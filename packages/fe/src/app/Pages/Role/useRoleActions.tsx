import { ActionsType, Icons } from '@edanalytics/common-ui';
import { GetRoleDto } from '@edanalytics/models';
import { useNavigate, useParams } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { roleQueries } from '../../api';
import { teamRoleAuthConfig, useAuthorize } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

export const useRoleActions = (role: GetRoleDto | undefined): ActionsType => {
  const navigate = useNavigate();
  const to = (id: number | string) => `/roles/${id}`;
  const deleteRole = roleQueries.delete({});
  const popBanner = usePopBanner();
  const params = useParams() as {
    asId: string;
    roleId: string;
  };

  const canView = useAuthorize(teamRoleAuthConfig(role?.id, Number(params.asId), 'team.role:read'));

  const canEdit = useAuthorize(
    teamRoleAuthConfig(role?.id, Number(params.asId), 'team.role:update')
  );

  const canDelete = useAuthorize(
    teamRoleAuthConfig(role?.id, Number(params.asId), 'team.role:delete')
  );

  return role === undefined
    ? {}
    : {
        ...(canView
          ? {
              View: {
                icon: Icons.View,
                text: 'View',
                title: 'View ' + role.displayName,
                to: to(role.id),
                onClick: () => navigate(to(role.id)),
              },
            }
          : {}),
        ...(canEdit
          ? {
              Edit: {
                icon: Icons.Edit,
                text: 'Edit',
                title: 'Edit ' + role.displayName,
                to: to(role.id) + '?edit=true',
                onClick: () => navigate(to(role.id) + '?edit=true'),
              },
            }
          : {}),
        ...(canDelete
          ? {
              Delete: {
                icon: Icons.Delete,
                isPending: deleteRole.isPending,
                text: 'Delete',
                title: 'Delete role',
                confirmBody: 'This will permanently delete the role.',
                onClick: () =>
                  deleteRole.mutateAsync(
                    { id: role.id },
                    {
                      ...mutationErrCallback({ popGlobalBanner: popBanner }),
                      onSuccess: () => navigate(`/roles`),
                    }
                  ),
                confirm: true,
              },
            }
          : {}),
      };
};
