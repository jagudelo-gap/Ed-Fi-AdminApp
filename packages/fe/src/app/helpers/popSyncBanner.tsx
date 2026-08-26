import { PgBossJobState, SbSyncQueueDto } from '@edanalytics/models';
import { usePopBanner } from '../Layout/FeedbackBanner';
import { Link as RouterLink } from 'react-router';
import { Link } from '@chakra-ui/react';

export const popSyncBanner = (args: {
  popBanner: ReturnType<typeof usePopBanner>;
  syncQueue: SbSyncQueueDto;
}) => {
  const failureStates: PgBossJobState[] = ['failed', 'cancelled', 'expired'];
  const pendingStates: PgBossJobState[] = ['created', 'retry', 'active'];
  args.popBanner({
    type:
      args.syncQueue.state === 'completed'
        ? 'Success'
        : failureStates.includes(args.syncQueue.state)
        ? 'Error'
        : 'Info',
    title: `Sync ${
      args.syncQueue.state === 'completed'
        ? 'completed'
        : failureStates.includes(args.syncQueue.state)
        ? 'contained an error'
        : 'queued'
    }`,
    message: (
      <>
        See the queue item for more details
        {pendingStates.includes(args.syncQueue.state) ? ' and updated status' : ''}:{' '}
        <Link as={RouterLink} to={`/sb-sync-queues/${args.syncQueue.id}`}>
          /sb-sync-queues/{args.syncQueue.id}
        </Link>
        .
      </>
    ),
  });
};
