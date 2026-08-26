import { ActionsType, Icons } from '@edanalytics/common-ui';
import { SbSyncQueueDto } from '@edanalytics/models';
import { useNavigate } from 'react-router';
import { useAuthorize } from '../../helpers';

export const useSbSyncQueueActions = (sbSyncQueue: SbSyncQueueDto | undefined): ActionsType => {
  const navigate = useNavigate();
  const to = (id: number | string) => `/sb-sync-queues/${id}`;

  const canView = useAuthorize(
    sbSyncQueue && {
      privilege: 'sb-sync-queue:read',
      subject: {
        id: sbSyncQueue.id,
      },
    }
  );

  return sbSyncQueue === undefined
    ? {}
    : {
        ...(canView
          ? {
              View: {
                icon: Icons.View,
                text: 'View',
                title: 'View ' + sbSyncQueue.displayName,
                to: to(sbSyncQueue.id),
                onClick: () => navigate(to(sbSyncQueue.id)),
              },
            }
          : {}),
      };
};
