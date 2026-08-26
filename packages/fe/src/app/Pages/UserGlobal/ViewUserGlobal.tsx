import { Tag } from '@chakra-ui/react';
import {
  Attribute,
  AttributeContainer,
  AttributesGrid,
  ContentSection,
} from '@edanalytics/common-ui';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { roleQueries, userQueries } from '../../api';
import { RoleGlobalLink } from '../../routes/role-global.routes';

export const ViewUserGlobal = () => {
  const params = useParams() as {
    userId: string;
  };
  const user = useQuery(
    userQueries.getOne({
      id: params.userId,
    })
  ).data;
  const roles = useQuery(roleQueries.getAll({}));

  const isHuman = user?.userType === 'human';

  return user ? (
    <ContentSection>
      <AttributesGrid>
        {isHuman ? (
          <>
            <Attribute label="Given Name" value={user.givenName} />
            <Attribute label="Family Name" value={user.familyName} />
          </>
        ) : (
          <>
            <Attribute label="Machine Description" value={user.description} />
            <Attribute label="Client ID" value={user.clientId} />
          </>
        )}
        <Attribute isCopyable label="Username" value={user.username} />
        <AttributeContainer label="Status">
          {user.isActive ? (
            <Tag colorScheme="green">Active</Tag>
          ) : (
            <Tag colorScheme="orange">Inactive</Tag>
          )}
        </AttributeContainer>
        <AttributeContainer label="Role">
          <RoleGlobalLink id={user.roleId} query={roles} />
        </AttributeContainer>
      </AttributesGrid>
    </ContentSection>
  ) : null;
};
