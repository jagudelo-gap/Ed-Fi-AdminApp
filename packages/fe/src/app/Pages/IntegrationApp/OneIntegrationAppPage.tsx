import { useParams } from 'react-router';
import omit from 'lodash/omit';
import {
  Attribute,
  AttributeContainer,
  AttributesGrid,
  ContentSection,
  OneTimeShareLink,
  PageActions,
  PageContentCard,
  PageTemplate,
} from '@edanalytics/common-ui';
import { useGetOneIntegrationApp } from '../../api-v2';
import { useOneIntegrationAppActions } from './useOneIntegrationAppActions';
import { IntegrationProviderLink } from '../IntegrationProvider/IntegrationProviderLink';
import { UnorderedList } from '@chakra-ui/react';

export function OneIntegrationAppPage() {
  const { integrationAppId, integrationProviderId } = useParams() as {
    integrationAppId: string;
    integrationProviderId: string;
  };

  const integrationApp = useGetOneIntegrationApp({
    queryArgs: { integrationAppId, integrationProviderId },
  }).data;

  const actions = useOneIntegrationAppActions(integrationApp);

  if (!integrationApp) return null;

  const { applicationName, edfiTenantName, edorgNames, odsName, sbEnvironmentName } =
    integrationApp;

  return (
    <PageTemplate
      title={applicationName || 'Integration Application'}
      actions={<PageActions actions={omit(actions, 'View')} />}
      customPageContentCard
    >
      <PageContentCard>
        <ContentSection>
          <AttributesGrid>
            <Attribute isCopyable label="Integration Application Name" value={applicationName} />
            <AttributeContainer label="Integration Provider">
              <IntegrationProviderLink id={Number(integrationProviderId)} />
            </AttributeContainer>
            <AttributeContainer label="Ed-org">
              {!!edorgNames?.length && (
                <UnorderedList>
                  {edorgNames.map((edorgName) => (
                    <li key={edorgName}>{edorgName}</li>
                  ))}
                </UnorderedList>
              )}
            </AttributeContainer>
            <Attribute label="ODS" value={odsName} />
            <Attribute label="Starting Blocks Environment" value={sbEnvironmentName} />
            <Attribute label="EdFi Tenant" value={edfiTenantName} />
          </AttributesGrid>
        </ContentSection>
      </PageContentCard>
      <OneTimeShareLink />
    </PageTemplate>
  );
}
