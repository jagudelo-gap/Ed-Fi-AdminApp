import {
  ContentSection,
  PageActions,
  PageContentCard,
  PageSectionActions,
  PageTemplate,
} from '@edanalytics/common-ui';
import { useQuery } from '@tanstack/react-query';
import omit from 'lodash/omit';
import { useParams } from 'react-router';
import { odsQueries } from '../../api';
import {
  AuthorizeComponent,
  useTeamEdfiTenantNavContextLoaded,
  VersioningHoc,
} from '../../helpers';
import { useEdorgsActions } from '../Edorg/useEdorgsActions';
import { OdsEdorgsTable } from './OdsEdorgsTable';
import { ViewOds } from './ViewOds';
import { useOdsActions } from './useOdsActions';
import { OdsRowCountsTable } from './OdsRowCountsTable';
import { useSyncEdOrgsAction } from './useSyncEdOrgsAction';
import { useOdsTerminology } from './useOdsTerminology';

export const OdsPage = () => {
  const params = useParams() as {
    odsId: string;
  };
  const { teamId, edfiTenant, sbEnvironment } = useTeamEdfiTenantNavContextLoaded();
  const ods = useQuery(
    odsQueries.getOne({
      id: params.odsId,
      edfiTenant,
      teamId,
    })
  ).data;

  const actions = useOdsActions({
    id: Number(params.odsId),
    instanceManageId: ods?.instanceManageId ?? null,
    status: ods?.status ?? null,
  });
  const edorgsActions = useEdorgsActions({ ods });
  const syncEdOrgsActions = useSyncEdOrgsAction();
  const terminology = useOdsTerminology();
  return (
    <PageTemplate
      title={ods?.displayName || terminology.singular}
      actions={<PageActions actions={omit(actions, 'View')} />}
      customPageContentCard
    >
      {ods ? (
        <>
          <PageContentCard>
            <ViewOds />
          </PageContentCard>
          <AuthorizeComponent
            config={{
              privilege: 'team.sb-environment.edfi-tenant.ods.edorg:read',
              subject: {
                id: '__filtered__',
                edfiTenantId: edfiTenant.id,
                teamId,
              },
            }}
          >
            <PageContentCard>
              <PageSectionActions actions={{ ...edorgsActions, ...syncEdOrgsActions }} />
              <ContentSection heading="Ed-Orgs">
                <OdsEdorgsTable />
              </ContentSection>
            </PageContentCard>
          </AuthorizeComponent>
          {sbEnvironment.startingBlocks && (
            <VersioningHoc
              v2={
                <AuthorizeComponent
                  config={{
                    privilege: 'team.sb-environment.edfi-tenant.ods:read-row-counts',
                    subject: {
                      id: params.odsId,
                      edfiTenantId: edfiTenant.id,
                      teamId,
                    },
                  }}
                >
                  <PageContentCard>
                    <ContentSection heading="ODS Row Counts">
                      <OdsRowCountsTable />
                    </ContentSection>
                  </PageContentCard>
                </AuthorizeComponent>
              }
            />
          )}
        </>
      ) : null}
    </PageTemplate>
  );
};
