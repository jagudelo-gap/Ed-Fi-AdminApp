import { Attribute, AttributesGrid, ContentSection, PageContentCard } from '@edanalytics/common-ui';
import { useParams } from 'react-router';
import { useGetOneIntegrationProvider } from '../../api-v2';
import { useNavContext } from '../../helpers';
import { IntegrationAppsTable } from '../IntegrationApp/IntegrationAppsTable';

export const ViewIntegrationProvider = () => {
  const { asId: asTeamId } = useNavContext();

  const { integrationProviderId } = useParams() as { integrationProviderId: string };
  const integrationProvider = useGetOneIntegrationProvider({
    queryArgs: { integrationProviderId },
  }).data;

  return (
    <PageContentCard>
      <ContentSection>
        <AttributesGrid>
          <Attribute label="Name" value={integrationProvider?.name} />
          <Attribute label="Description" value={integrationProvider?.description} />
        </AttributesGrid>
      </ContentSection>
      {!!asTeamId && (
        <ContentSection heading="Integration Applications">
          <IntegrationAppsTable integrationProviderId={Number(integrationProviderId)} />
        </ContentSection>
      )}
    </PageContentCard>
  );
};
