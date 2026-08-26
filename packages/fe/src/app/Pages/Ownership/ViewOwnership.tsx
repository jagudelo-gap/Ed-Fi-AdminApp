import { useQuery } from '@tanstack/react-query';
import { Attribute, AttributesGrid, ContentSection } from '@edanalytics/common-ui';
import { useParams } from 'react-router';
import { ownershipQueries } from '../../api';

export const ViewOwnership = () => {
  const params = useParams() as {
    asId: string;
    edfiTenantId: string;
    ownershipId: string;
  };
  const ownership = useQuery(
    ownershipQueries.getOne({
      id: params.ownershipId,
      teamId: params.asId,
    })
  ).data;

  return ownership ? (
    <ContentSection>
      <AttributesGrid>
        <Attribute label="Id" value={ownership.id} />{' '}
      </AttributesGrid>
    </ContentSection>
  ) : null;
};
