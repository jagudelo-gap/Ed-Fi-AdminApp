import { PageActions, PageTemplate } from '@edanalytics/common-ui';
import { useQuery } from '@tanstack/react-query';
import omit from 'lodash/omit';
import { useParams } from 'react-router';
import { roleQueries } from '../../api';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { EditRole } from './EditRole';
import { ViewRole } from './ViewRole';
import { useRoleActions } from './useRoleActions';

export const RolePage = () => {
  const params = useParams() as {
    asId: string;
    roleId: string;
  };
  const role = useQuery(
    roleQueries.getOne({
      id: params.roleId,
      teamId: params.asId,
    })
  ).data;
  const { edit } = useSearchParamsObject() as { edit?: boolean };
  const actions = useRoleActions(role);

  return (
    <PageTemplate
      constrainWidth
      title={role?.displayName || 'Role'}
      actions={<PageActions actions={omit(actions, 'View')} />}
    >
      {role ? edit ? <EditRole role={role} /> : <ViewRole role={role} /> : null}
    </PageTemplate>
  );
};
