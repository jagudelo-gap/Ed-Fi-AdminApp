import { PageActions, PageContentCard, PageTemplate } from '@edanalytics/common-ui';
import { useQuery } from '@tanstack/react-query';
import omit from 'lodash/omit';
import { useParams } from 'react-router';
import { sbEnvironmentQueries } from '../../api';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { EditSbEnvironment } from './EditSbEnvironment';
import { EditSbEnvironmentMeta } from './EditSbEnvironmentMeta';
import { ViewSbEnvironmentGlobal } from './ViewSbEnvironmentGlobal';
import { useSbEnvironmentGlobalActions } from './useSbEnvironmentGlobalActions';

export const SbEnvironmentGlobalPage = () => {
  const params = useParams() as { sbEnvironmentId: string };
  const sbEnvironment = useQuery(
    sbEnvironmentQueries.getOne({
      id: params.sbEnvironmentId,
    })
  ).data;
  const { edit } = useSearchParamsObject() as {
    edit?: 'sb-environment-meta' | 'name';
  };

  const actions = useSbEnvironmentGlobalActions(sbEnvironment);

  return (
    <PageTemplate
      title={sbEnvironment?.displayName || 'SbEnvironment'}
      actions={<PageActions actions={omit(actions, 'View')} />}
      customPageContentCard
    >
      {sbEnvironment ? (
        edit ? (
          <PageContentCard>
            {edit === 'sb-environment-meta' ? (
              <EditSbEnvironmentMeta sbEnvironment={sbEnvironment} />
            ) : edit === 'name' ? (
              <EditSbEnvironment sbEnvironment={sbEnvironment} />
            ) : null}
          </PageContentCard>
        ) : (
          <ViewSbEnvironmentGlobal sbEnvironment={sbEnvironment} />
        )
      ) : null}
    </PageTemplate>
  );
};
