import { Link, ListItem, UnorderedList } from '@chakra-ui/react';
import {
  Attribute,
  AttributeContainer,
  AttributesGrid,
  ContentSection,
} from '@edanalytics/common-ui';
import { Link as RouterLink } from 'react-router';
import { IDP_ACCOUNT_URL, useMe } from '../../api';
import { ExternalLinkIcon } from '@chakra-ui/icons';

export const ViewAccount = () => {
  const me = useMe();
  const user = me.data;
  const utmArr = user?.userTeamMemberships ?? [];

  return user ? (
    <ContentSection>
      <AttributesGrid>
        <Attribute label="Username" value={user.username} />
        <Attribute label="User role" value={user.role?.displayName} />
        {utmArr.length > 1 ? (
          <AttributeContainer label="Teams">
            <UnorderedList>
              {utmArr.map((t) => (
                <ListItem key={t.id}>
                  <Link as={RouterLink} to={`/as/${t.team.id}`}>
                    {t.team.displayName}
                  </Link>
                </ListItem>
              ))}
            </UnorderedList>
          </AttributeContainer>
        ) : utmArr.length > 0 ? (
          <Attribute label="Team" value={utmArr[0].team.displayName} />
        ) : null}

        {IDP_ACCOUNT_URL ? (
          <AttributeContainer label="Account Management">
            <Link href={IDP_ACCOUNT_URL} isExternal color="blue.500" target="_blank">
              Manage your account in Identity Provider <ExternalLinkIcon mx="2px" />
            </Link>
          </AttributeContainer>
        ) : null}
      </AttributesGrid>
    </ContentSection>
  ) : null;
};
