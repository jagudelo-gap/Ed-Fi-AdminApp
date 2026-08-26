import { useQuery } from '@tanstack/react-query';
import { Attribute, AttributesGrid, ContentSection } from '@edanalytics/common-ui';
import { useParams } from 'react-router';
import { userQueries } from '../../../api';

export const ViewUser = () => {
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

  return user ? (
    <ContentSection>
      <AttributesGrid>
        <Attribute label="Given Name" value={user.givenName} />
        <Attribute label="Family Name" value={user.familyName} />
        <Attribute isCopyable label="Username" value={user.username} />
      </AttributesGrid>
    </ContentSection>
  ) : null;
};
