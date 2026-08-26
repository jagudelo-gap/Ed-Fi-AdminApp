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
import { sbEnvironmentQueries } from '../../api';
import { useTeamNavContext } from '../../helpers';
import { EdfiTenantsTable } from '../EdfiTenant/EdfiTenantsPage';
import { useEdfiTenantsActions } from '../EdfiTenant/useEdfiTenantsActions';
import { ViewSbEnvironment } from './ViewSbEnvironment';

export const SbEnvironmentPage = () => {
  const { teamId } = useTeamNavContext();
  const params = useParams() as {
    sbEnvironmentId: string;
  };
  const sbEnvironment = useQuery(
    sbEnvironmentQueries.getOne({
      id: params.sbEnvironmentId,
      teamId,
    })
  ).data;

  const actions = {};
  const tenantsActions = useEdfiTenantsActions();

  return (
    <PageTemplate
      title={sbEnvironment?.displayName || 'Starting Blocks environment'}
      actions={<PageActions actions={omit(actions, 'View')} />}
      customPageContentCard
    >
      <PageContentCard>
        {sbEnvironment ? <ViewSbEnvironment sbEnvironment={sbEnvironment} /> : null}
      </PageContentCard>
      <PageContentCard>
        {sbEnvironment ? (
          <>
            <PageSectionActions actions={tenantsActions} />
            <ContentSection heading="Tenants">
              <EdfiTenantsTable />
            </ContentSection>
          </>
        ) : null}
      </PageContentCard>
    </PageTemplate>
  );
};
