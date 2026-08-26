import { useQuery } from '@tanstack/react-query';
import { PageActions, PageTemplate } from '@edanalytics/common-ui';
import omit from 'lodash/omit';
import { useParams } from 'react-router';
import { sbSyncQueueQueries } from '../../api';
import { ViewSbSyncQueue } from './ViewSbSyncQueue';
import { useSbSyncQueueActions } from './useSbSyncQueueActions';

export const SbSyncQueuePage = () => {
  const params = useParams() as { sbSyncQueueId: string };
  const sbSyncQueue = useQuery(
    sbSyncQueueQueries.getOne({
      id: params.sbSyncQueueId,
    })
  ).data;
  const actions = useSbSyncQueueActions(sbSyncQueue);
  return (
    <PageTemplate
      title={sbSyncQueue?.displayName || 'SbSyncQueue'}
      actions={<PageActions actions={omit(actions, 'View')} />}
    >
      {sbSyncQueue ? <ViewSbSyncQueue /> : null}
    </PageTemplate>
  );
};
