import { useQuery } from '@tanstack/react-query';
import { PageActions, PageTemplate } from '@edanalytics/common-ui';
import omit from 'lodash/omit';
import { useParams } from 'react-router';
import { ownershipQueries } from '../../api';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { EditOwnershipGlobal } from './EditOwnershipGlobal';
import { ViewOwnershipGlobal } from './ViewOwnershipGlobal';
import { useOwnershipGlobalActions } from './useOwnershipGlobalActions';

export const OwnershipGlobalPage = () => {
  const params = useParams() as {
    ownershipId: string;
  };
  const ownership = useQuery(
    ownershipQueries.getOne({
      id: params.ownershipId,
    })
  ).data;
  const { edit } = useSearchParamsObject() as { edit?: boolean };
  const actions = useOwnershipGlobalActions(ownership);

  return (
    <PageTemplate
      constrainWidth
      title={ownership?.displayName || 'Ownership'}
      actions={<PageActions actions={omit(actions, 'View')} />}
    >
      {ownership ? (
        edit ? (
          <EditOwnershipGlobal ownership={ownership} />
        ) : (
          <ViewOwnershipGlobal />
        )
      ) : null}
    </PageTemplate>
  );
};
