import { Button } from '@chakra-ui/react';
import { ActionsType, Icons } from '@edanalytics/common-ui';
import { GetRoleDto } from '@edanalytics/models';
import { isExplicitStatusResponse } from '@edanalytics/utils';
import { useNavigate } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { roleQueries } from '../../api';
import { globalRoleAuthConfig, useAuthorize } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

export const useRoleGlobalActions = (role: GetRoleDto | undefined): ActionsType => {
  const navigate = useNavigate();
  const to = (id: number | string) => `/roles/${id}`;
  const deleteRole = roleQueries.delete({});
  const deleteRoleForce = roleQueries.deleteForce({});
  const popBanner = usePopBanner();

  const canView = useAuthorize(globalRoleAuthConfig(role?.id, 'role:read'));

  const canEdit = useAuthorize(globalRoleAuthConfig(role?.id, 'role:update'));
  const canDelete = useAuthorize(globalRoleAuthConfig(role?.id, 'role:delete'));

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
                text: 'Delete',
                title: 'Delete role',
                confirmBody: 'This will permanently delete the role.',
                onClick: () =>
                  deleteRole.mutateAsync(
                    { id: role.id },
                    {
                      onError: (err: unknown) => {
                        if (isExplicitStatusResponse(err) && err.type === 'RequiresForceDelete') {
                          popBanner((props) => ({
                            type: err.type,
                            message: (
                              <>
                                {err.message?.toString() ??
                                  'This role is referenced by other entities.'}
                                <Button
                                  ml={4}
                                  size="sm"
                                  h="auto"
                                  py={1}
                                  colorScheme="red"
                                  variant="outline"
                                  onClick={() => {
                                    deleteRoleForce.mutateAsync(
                                      { id: role.id, pathParams: {} },
                                      {
                                        onSuccess: () => {
                                          popBanner({
                                            type: 'Success',
                                            title: 'Role deleted',
                                          });
                                          navigate(`/roles`);
                                        },
                                        ...mutationErrCallback({ popGlobalBanner: popBanner }),
                                        onSettled: props.onDelete,
                                      }
                                    );
                                  }}
                                >
                                  Use force delete
                                </Button>
                              </>
                            ),
                            title: 'Force delete required',
                          }));
                          return undefined;
                        }
                        mutationErrCallback({ popGlobalBanner: popBanner }).onError(err);
                      },
                      onSuccess: () => navigate(`/roles`),
                    }
                  ),
                confirm: true,
              },
            }
          : {}),
      };
};
