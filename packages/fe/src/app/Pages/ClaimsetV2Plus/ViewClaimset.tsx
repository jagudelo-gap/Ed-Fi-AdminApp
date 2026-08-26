import { Tooltip } from '@chakra-ui/react';
import {
  Attribute,
  AttributeContainer,
  AttributesGrid,
  ContentSection,
} from '@edanalytics/common-ui';
import { GetClaimsetSingleDtoV2, GetClaimsetSingleDtoV3 } from '@edanalytics/models';
import { ComponentType } from 'react';

function ViewClaimset<D extends GetClaimsetSingleDtoV2 | GetClaimsetSingleDtoV3>({
  claimset,
  ResourceClaimsTable,
}: {
  claimset: D;
  ResourceClaimsTable: ComponentType<{ claimset: D }>;
}) {
  return claimset ? (
    <>
      <ContentSection>
        <AttributesGrid>
          <AttributeContainer label="Is system-reserved">
            <Tooltip
              hasArrow
              label="System-reserved claimsets cannot be used to create applications."
            >
              <span>{String(!!claimset._isSystemReserved)}</span>
            </Tooltip>
          </AttributeContainer>
          <Attribute label="Applications" value={claimset._applications.length} />
        </AttributesGrid>
      </ContentSection>
      <ContentSection heading="Resource claims">
        <ResourceClaimsTable claimset={claimset} />
      </ContentSection>
    </>
  ) : null;
}

export default ViewClaimset;
