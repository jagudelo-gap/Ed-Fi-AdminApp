import { useQuery } from '@tanstack/react-query';
import { PageActions, PageTemplate } from '@edanalytics/common-ui';
import omit from 'lodash/omit';
import { useParams } from 'react-router';
import { userQueries } from '../../../api';

import { useSearchParamsObject } from '../../../helpers/useSearch';
import { EditUser } from './EditUser';
import { ViewUser } from './ViewUser';

export const UserPage = () => {
  const params = useParams() as {
    asId: string;
    userId: string;
  };
  const user = useQuery(
    userQueries.getOne({
      id: params.userId,
      teamId: params.asId,
    })
  ).data;
  const { edit } = useSearchParamsObject() as { edit?: boolean };

  const actions = {};

  return (
    <PageTemplate
      constrainWidth
      title={user?.displayName || 'User'}
      actions={<PageActions actions={omit(actions, 'View')} />}
    >
      {user ? edit ? <EditUser /> : <ViewUser /> : null}
    </PageTemplate>
  );
};
