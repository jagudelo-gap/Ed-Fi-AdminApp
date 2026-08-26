import { useQuery } from '@tanstack/react-query';
import {
  PageActions,
  PageContentCard,
  PageSectionActions,
  PageTemplate,
} from '@edanalytics/common-ui';
import omit from 'lodash/omit';
import { useParams } from 'react-router';
import { teamQueries } from '../../api';

import { useSearchParamsObject } from '../../helpers/useSearch';
import { EditTeam } from './EditTeam';
import { TeamMembershipsTable, TeamOwnershipsTable, ViewTeam } from './ViewTeam';
import { useTeamActions } from './useTeamActions';
import { AuthorizeComponent } from '../../helpers';
import pick from 'lodash/pick';

export const TeamPage = () => {
  const params = useParams() as { teamId: string };
  const team = useQuery(
    teamQueries.getOne({
      id: params.teamId,
    })
  ).data;
  const { edit } = useSearchParamsObject() as { edit?: boolean };
  const allActions = useTeamActions(team);
  const actions = omit(allActions, ['Grant', 'Invite']);
  const ownershipsActions = pick(allActions, ['Grant']);
  const membershipsActions = pick(allActions, ['Invite']);
  return (
    <PageTemplate
      title={team?.displayName || 'Team'}
      actions={<PageActions actions={omit(actions, 'View')} />}
      customPageContentCard
    >
      {team ? (
        edit ? (
          <PageContentCard>
            <EditTeam />
          </PageContentCard>
        ) : (
          <>
            <PageContentCard>
              <ViewTeam />
            </PageContentCard>
            <PageContentCard>
              <PageSectionActions actions={ownershipsActions} />
              <AuthorizeComponent
                config={{
                  privilege: 'ownership:read',
                  subject: {
                    id: '__filtered__',
                  },
                }}
              >
                <TeamOwnershipsTable team={team} />
              </AuthorizeComponent>
            </PageContentCard>
            <PageContentCard>
              <PageSectionActions actions={membershipsActions} />
              <AuthorizeComponent
                config={{
                  privilege: 'user-team-membership:read',
                  subject: {
                    id: '__filtered__',
                  },
                }}
              >
                <TeamMembershipsTable team={team} />
              </AuthorizeComponent>
            </PageContentCard>
          </>
        )
      ) : null}
    </PageTemplate>
  );
};
