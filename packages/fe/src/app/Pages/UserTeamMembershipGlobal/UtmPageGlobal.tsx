import { useQuery } from '@tanstack/react-query';
import { PageActions, PageTemplate } from '@edanalytics/common-ui';
import omit from 'lodash/omit';
import { useParams } from 'react-router';
import { userTeamMembershipQueries } from '../../api';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { EditUtmGlobal } from './EditUtmGlobal';
import { ViewUtmGlobal } from './ViewUtmGlobal';
import { useUtmActionsGlobal } from './useUtmActionsGlobal';

export const UtmGlobalPage = () => {
  const params = useParams() as { userTeamMembershipId: string };
  const userTeamMembership = useQuery(
    userTeamMembershipQueries.getOne({
      id: params.userTeamMembershipId,
    })
  ).data;
  const { edit } = useSearchParamsObject() as { edit?: boolean };
  const actions = useUtmActionsGlobal(userTeamMembership);
  return (
    <PageTemplate
      title={userTeamMembership?.displayName || 'Team membership'}
      actions={<PageActions actions={omit(actions, 'View')} />}
      constrainWidth
    >
      {userTeamMembership ? edit ? <EditUtmGlobal /> : <ViewUtmGlobal /> : null}
    </PageTemplate>
  );
};
