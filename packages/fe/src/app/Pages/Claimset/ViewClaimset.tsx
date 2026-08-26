import { Tooltip } from '@chakra-ui/react';
import {
  Attribute,
  AttributeContainer,
  AttributesGrid,
  ContentSection,
  ResourceClaimsTable,
} from '@edanalytics/common-ui';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { claimsetQueriesV1 } from '../../api';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';

const ViewClaimset = () => {
  const params = useParams() as {
    claimsetId: string;
  };
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const claimset = useQuery(
    claimsetQueriesV1.getOne({
      id: params.claimsetId,
      edfiTenant,
      teamId,
    })
  ).data;

  return claimset ? (
    <>
      <ContentSection>
        <AttributesGrid>
          <AttributeContainer label="Is system-reserved">
            <Tooltip
              hasArrow
              label="System-reserved claimsets cannot be used to create applications."
            >
              <span>{String(!!claimset.isSystemReserved)}</span>
            </Tooltip>
          </AttributeContainer>
          <Attribute label="Applications" value={claimset.applicationsCount} />
        </AttributesGrid>
      </ContentSection>
      <ContentSection heading="Resource claims">
        <ResourceClaimsTable claimset={claimset} />
      </ContentSection>
    </>
  ) : null;
};

export default ViewClaimset;
