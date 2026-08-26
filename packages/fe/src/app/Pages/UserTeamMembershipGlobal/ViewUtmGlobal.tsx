import { useQuery } from '@tanstack/react-query';
import { AttributeContainer, AttributesGrid, ContentSection } from '@edanalytics/common-ui';
import { useParams } from 'react-router';
import { roleQueries, teamQueries, userTeamMembershipQueries } from '../../api';
import { TeamLink, UserGlobalLink } from '../../routes';
import { RoleGlobalLink } from '../../routes/role-global.routes';

export const ViewUtmGlobal = () => {
  const params = useParams() as { userTeamMembershipId: string };
  const userTeamMembership = useQuery(
    userTeamMembershipQueries.getOne({
      id: params.userTeamMembershipId,
    })
  ).data;
  const teams = useQuery(teamQueries.getAll({}));
  const roles = useQuery(roleQueries.getAll({}));

  return userTeamMembership ? (
    <ContentSection>
      <AttributesGrid>
        <AttributeContainer label="Team">
          <TeamLink query={teams} id={userTeamMembership.teamId} />
        </AttributeContainer>
        <AttributeContainer label="User">
          <UserGlobalLink id={userTeamMembership.userId} />
        </AttributeContainer>
        <AttributeContainer label="Role">
          {userTeamMembership.roleId === null ? (
            <>&nbsp;-&nbsp;</>
          ) : (
            <RoleGlobalLink query={roles} id={userTeamMembership.roleId} />
          )}
        </AttributeContainer>
        <AttributeContainer label="UserName">
          <UserGlobalLink id={userTeamMembership.userId} displayUsername={true} />
        </AttributeContainer>
      </AttributesGrid>
    </ContentSection>
  ) : null;
};
