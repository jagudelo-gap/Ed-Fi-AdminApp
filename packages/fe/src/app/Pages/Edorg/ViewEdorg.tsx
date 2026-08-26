import { useQuery } from '@tanstack/react-query';
import {
  Attribute,
  AttributeContainer,
  AttributesGrid,
  ContentSection,
} from '@edanalytics/common-ui';
import { useParams } from 'react-router';
import { edorgQueries, odsQueries, edfiTenantQueries } from '../../api';
import { EdorgLink, OdsLink, EdfiTenantLink, SbEnvironmentLink } from '../../routes';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { queryFromEntity } from '../../api/queries/builder';

export const ViewEdorg = () => {
  const params = useParams() as {
    edorgId: string;
  };
  const { teamId, edfiTenant, sbEnvironmentId, sbEnvironment } =
    useTeamEdfiTenantNavContextLoaded();
  const edorg = useQuery(
    edorgQueries.getOne({
      id: params.edorgId,
      edfiTenant,
      teamId,
    })
  ).data;
  const edorgs = useQuery(
    edorgQueries.getAll({
      edfiTenant,
      teamId,
    })
  );
  const odss = useQuery(
    odsQueries.getAll({
      edfiTenant,
      teamId,
    })
  );
  const edfiTenants = useQuery(
    edfiTenantQueries.getAll({
      teamId,
      sbEnvironmentId,
    })
  );

  return edorg ? (
    <ContentSection>
      <AttributesGrid>
        <Attribute isCopyable label="Ed-Org ID" value={edorg.educationOrganizationId} />
        <Attribute isCopyable label="Type" value={edorg.discriminator} />
        {edorg.parentId ? (
          <AttributeContainer label="Parent">
            <EdorgLink id={edorg.parentId} query={edorgs} />
          </AttributeContainer>
        ) : null}
        <AttributeContainer label="ODS">
          <OdsLink id={edorg.odsId} query={odss} />
        </AttributeContainer>
        <AttributeContainer label="Environment">
          <SbEnvironmentLink id={edorg.sbEnvironmentId} query={queryFromEntity(sbEnvironment)} />
        </AttributeContainer>
        <AttributeContainer label="Tenant">
          <EdfiTenantLink id={edorg.edfiTenantId} query={edfiTenants} />
        </AttributeContainer>
      </AttributesGrid>
    </ContentSection>
  ) : null;
};
