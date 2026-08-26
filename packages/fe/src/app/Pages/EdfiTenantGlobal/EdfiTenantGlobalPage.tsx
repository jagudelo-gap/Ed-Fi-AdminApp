import { PageActions, PageContentCard, PageTemplate } from '@edanalytics/common-ui';
import { useQuery } from '@tanstack/react-query';
import omit from 'lodash/omit';
import { useParams } from 'react-router';
import { edfiTenantQueriesGlobal } from '../../api';
import { VersioningHoc, useSbEnvironmentNavContext } from '../../helpers';
import { ViewEdfiTenantGlobal } from './ViewEdfiTenantGlobal';
import { useEdfiTenantGlobalActions } from './useEdfiTenantGlobalActions';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { RegisterEdfiTenantAdminApi } from './RegisterEdfiTenantAdminApi';

export const EdfiTenantGlobalPage = () => {
  const params = useParams() as {
    edfiTenantId: string;
  };
  const { sbEnvironmentId } = useSbEnvironmentNavContext();
  const edfiTenant = useQuery(
    edfiTenantQueriesGlobal.getOne({
      id: params.edfiTenantId,
      sbEnvironmentId,
    })
  ).data;
  const actions = useEdfiTenantGlobalActions(edfiTenant);
  const { edit } = useSearchParamsObject() as {
    edit?: 'admin-api';
  };

  return (
    <PageTemplate
      title={edfiTenant?.displayName || 'EdfiTenant'}
      actions={<PageActions actions={omit(actions, 'View')} />}
      customPageContentCard
    >
      {edfiTenant ? (
        edit === 'admin-api' ? (
          <PageContentCard>
            <VersioningHoc
              v1={<RegisterEdfiTenantAdminApi edfiTenant={edfiTenant} />}
              v2={<>Use the separate Keygen feature for newer Starting Blocks environments.</>}
            />
          </PageContentCard>
        ) : (
          <ViewEdfiTenantGlobal edfiTenant={edfiTenant} />
        )
      ) : null}
    </PageTemplate>
  );
};
