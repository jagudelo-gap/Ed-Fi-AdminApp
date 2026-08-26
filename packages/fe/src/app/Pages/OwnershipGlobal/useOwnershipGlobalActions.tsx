import { ActionsType, Icons } from '@edanalytics/common-ui';
import { GetOwnershipDto, GetOwnershipViewDto } from '@edanalytics/models';
import { useNavigate } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { ownershipQueries } from '../../api';
import { useAuthorize } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

export const useOwnershipGlobalActions = (
  ownership: GetOwnershipDto | GetOwnershipViewDto | undefined
): ActionsType => {
  const popBanner = usePopBanner();
  const navigate = useNavigate();
  const to = (id: number | string) => `/ownerships/${id}`;
  const deleteOwnership = ownershipQueries.delete({});

  const canView = useAuthorize(
    ownership && {
      privilege: 'ownership:read',
      subject: {
        id: ownership.id,
      },
    }
  );

  const canEdit = useAuthorize(
    ownership && {
      privilege: 'ownership:update',
      subject: {
        id: ownership.id,
      },
    }
  );

  const canDelete = useAuthorize(
    ownership && {
      privilege: 'ownership:delete',
      subject: {
        id: ownership.id,
      },
    }
  );

  return ownership === undefined
    ? {}
    : {
        ...(canView
          ? {
              View: {
                icon: Icons.View,
                text: 'View',
                title: 'View ' + ownership.displayName,
                to: to(ownership.id),
                onClick: () => navigate(to(ownership.id)),
              },
            }
          : {}),
        ...(canEdit
          ? {
              Edit: {
                icon: Icons.Edit,
                text: 'Edit',
                title: 'Edit ' + ownership.displayName,
                to: to(ownership.id) + '?edit=true',
                onClick: () => navigate(to(ownership.id) + '?edit=true'),
              },
            }
          : {}),
        ...(canDelete
          ? {
              Delete: {
                icon: Icons.Delete,
                isPending: deleteOwnership.isPending,
                text: 'Delete',
                title: 'Delete ownership',
                confirmBody: 'This will permanently delete the ownership.',
                onClick: () =>
                  deleteOwnership.mutateAsync(
                    { id: ownership.id },
                    {
                      ...mutationErrCallback({ popGlobalBanner: popBanner }),
                      onSuccess: () => navigate(`/ownerships`),
                    }
                  ),
                confirm: true,
              },
            }
          : {}),
      };
};
