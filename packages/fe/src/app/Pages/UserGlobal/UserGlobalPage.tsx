import { useQuery } from '@tanstack/react-query';
import { PageActions, PageTemplate } from '@edanalytics/common-ui';
import omit from 'lodash/omit';
import { useParams } from 'react-router';
import { userQueries } from '../../api';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { EditUserGlobal } from './EditUserGlobal';
import { ViewUserGlobal } from './ViewUserGlobal';
import { useUserGlobalActions } from './useUserGlobalActions';

export const UserGlobalPage = () => {
  const params = useParams() as {
    userId: string;
  };
  const user = useQuery(
    userQueries.getOne({
      id: params.userId,
    })
  ).data;
  const { edit } = useSearchParamsObject() as { edit?: boolean };
  const actions = useUserGlobalActions(user);

  return (
    <PageTemplate
      title={user?.displayName || 'User'}
      actions={<PageActions actions={omit(actions, 'View')} />}
    >
      {user ? edit ? <EditUserGlobal user={user} /> : <ViewUserGlobal /> : null}
    </PageTemplate>
  );
};
