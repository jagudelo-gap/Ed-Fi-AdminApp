import {
  Attribute,
  AttributeContainer,
  AttributesGrid,
  ContentSection,
  PageContentCard,
} from '@edanalytics/common-ui';
import { GetEdfiTenantDto } from '@edanalytics/models';
import { AuthorizeComponent, useSbEnvironmentNavContextLoaded, withLoader } from '../../helpers';
import { SbSyncQueuesTable } from '../SbSyncQueue/SbSyncQueuesPage';
import { SbEnvironmentGlobalLink } from '../../routes';

export const ViewEdfiTenantGlobal = withLoader((props: { edfiTenant: GetEdfiTenantDto }) => {
  const { edfiTenant } = props;
  const { sbEnvironment } = useSbEnvironmentNavContextLoaded();
  const allowedEdorgs =
    sbEnvironment?.configPublic?.values && 'tenants' in sbEnvironment.configPublic.values
      ? sbEnvironment?.configPublic?.values?.tenants?.[edfiTenant.name]?.allowedEdorgs
      : undefined;
  return (
    <>
      <PageContentCard>
        <ContentSection>
          <AttributesGrid>
            <Attribute isCopyable label="Name" value={edfiTenant.name} />
            <AttributeContainer label="Environment">
              <SbEnvironmentGlobalLink
                id={sbEnvironment.id}
                query={{ data: { [sbEnvironment.id]: sbEnvironment } }}
              />
            </AttributeContainer>
            <Attribute label="Created" value={edfiTenant.created} isDate />
            {allowedEdorgs?.length && (
              <Attribute label="Allowed Ed-Orgs" value={allowedEdorgs.join(', ')} />
            )}
          </AttributesGrid>
        </ContentSection>
      </PageContentCard>
      {(sbEnvironment.startingBlocks || sbEnvironment.version === 'v2') && (
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
              defaultFilters={[{ id: 'edfiTenantId', value: edfiTenant.id }]}
            />
          </ContentSection>
        </PageContentCard>
      </AuthorizeComponent>)}
    </>
  );
});
