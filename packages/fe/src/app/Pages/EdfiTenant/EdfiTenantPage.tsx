import { PageActions, PageTemplate } from '@edanalytics/common-ui';
import { useQuery } from '@tanstack/react-query';
import omit from 'lodash/omit';
import { useParams } from 'react-router';
import { edfiTenantQueries } from '../../api';
import { useTeamNavContext } from '../../helpers';
import { ViewEdfiTenant } from './ViewEdfiTenant';
import { useEdfiTenantActions } from './useEdfiTenantActions';

export const EdfiTenantPage = () => {
  const { teamId } = useTeamNavContext();
  const params = useParams() as {
    edfiTenantId: string;
    sbEnvironmentId: string;
  };
  const edfiTenant = useQuery(
    edfiTenantQueries.getOne({
      id: params.edfiTenantId,
      sbEnvironmentId: params.sbEnvironmentId,
      teamId,
    })
  ).data;

  const actions = useEdfiTenantActions(edfiTenant);

  return (
    <PageTemplate
      title={edfiTenant?.displayName || 'EdfiTenant'}
      actions={<PageActions actions={omit(actions, 'View')} />}
    >
      {edfiTenant ? <ViewEdfiTenant edfiTenant={edfiTenant} /> : null}
    </PageTemplate>
  );
};
