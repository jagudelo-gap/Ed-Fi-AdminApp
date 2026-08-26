import { PageActions, PageTemplate } from '@edanalytics/common-ui';
import omit from 'lodash/omit';
import { useParams } from 'react-router';
import { edorgQueries } from '../../api';
import { ViewEdorg } from './ViewEdorg';
import { useQuery } from '@tanstack/react-query';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { SbEnvironmentSyncDateOverlay } from '../SbEnvironment/SbEnvironmentSyncDate';
import { useEdorgActions } from './useEdorgActions';

export const EdorgPage = () => {
  const params = useParams() as {
    edorgId: string;
  };
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const edorg = useQuery(
    edorgQueries.getOne({
      id: params.edorgId,
      edfiTenant,
      teamId,
    })
  ).data;
  const actions = useEdorgActions(edorg ?? { id: Number(params.edorgId) });

  return (
    <PageTemplate
      title={edorg?.displayName || 'Edorg'}
      actions={<PageActions actions={omit(actions, 'View')} />}
    >
      <SbEnvironmentSyncDateOverlay />
      {edorg ? <ViewEdorg /> : null}
    </PageTemplate>
  );
};
