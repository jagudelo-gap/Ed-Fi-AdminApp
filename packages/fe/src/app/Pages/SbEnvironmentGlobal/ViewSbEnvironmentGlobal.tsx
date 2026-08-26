import {
  Attribute,
  AttributesGrid,
  ContentSection,
  PageContentCard,
  PageSectionActions,
} from '@edanalytics/common-ui';
import { GetSbEnvironmentDto } from '@edanalytics/models';
import { AuthorizeComponent } from '../../helpers';
import { SbSyncQueuesTable } from '../SbSyncQueue/SbSyncQueuesPage';
import { EdfiTenantsGlobalTable } from '../EdfiTenantGlobal/EdfiTenantsGlobalPage';
import { Text } from '@chakra-ui/react';
import { useEdfiTenantsGlobalActions } from '../EdfiTenantGlobal/useEdfiTenantsGlobalActions';

export const ViewSbEnvironmentGlobal = (props: { sbEnvironment: GetSbEnvironmentDto }) => {
  const { sbEnvironment } = props;
  const tenantsActions = useEdfiTenantsGlobalActions();
  return (
    <>
      <PageContentCard>
        <ContentSection>
          <AttributesGrid>
            <Attribute isCopyable label="Environment label" value={sbEnvironment.envLabel} />
            <Attribute
              isCopyable
              isUrl
              isUrlExternal
              label="Ed-Fi API Domain"
              value={sbEnvironment.usableDomain}
            />
            <Attribute label="Created" value={sbEnvironment.created} isDate />
            <Attribute
              isCopyable
              isUrl
              isUrlExternal
              label="Admin API"
              value={sbEnvironment.adminApiUrl}
            />
            <Attribute isCopyable label="Ed-Fi API version" value={sbEnvironment.odsApiVersion} />
            <Attribute
              isCopyable
              label="Data standard version"
              value={sbEnvironment.odsDsVersion}
            />
            <Attribute
              isCopyable
              label="Admin App system version"
              value={sbEnvironment.configPublic?.version}
            />
            {sbEnvironment.startingBlocks && (
              <Attribute
                isCopyable
                label="Metadata ARN"
                value={sbEnvironment.configPublic?.sbEnvironmentMetaArn}
              />
            )}
          </AttributesGrid>
        </ContentSection>
        <Text mt={6}>
          <i>
            Looking for Admin API connection setup? That's been moved to each Tenant's own page.
          </i>
        </Text>
      </PageContentCard>
      <AuthorizeComponent
        config={{
          privilege: 'sb-environment.edfi-tenant:read',
          subject: {
            id: '__filtered__',
          },
        }}
      >
        <PageContentCard>
          <PageSectionActions actions={tenantsActions} />
          <ContentSection heading="Tenants">
            <EdfiTenantsGlobalTable />
          </ContentSection>
        </PageContentCard>
      </AuthorizeComponent>
      {(sbEnvironment.startingBlocks || sbEnvironment.version !== 'v1') && (
        <AuthorizeComponent
          config={{
            privilege: 'sb-sync-queue:read',
            subject: {
              id: '__filtered__',
            },
          }}
        >
          <PageContentCard>
            <ContentSection heading="Sync queue">
              <SbSyncQueuesTable
                defaultFilters={[
                  { id: 'sbEnvironmentId', value: sbEnvironment.id },
                ]}
              />
            </ContentSection>
          </PageContentCard>
        </AuthorizeComponent>
      )}
    </>
  );
};
