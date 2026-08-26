import { useQuery } from '@tanstack/react-query';
import { PageActions, PageTemplate } from '@edanalytics/common-ui';
import omit from 'lodash/omit';
import { useParams } from 'react-router';
import { roleQueries } from '../../api';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { ViewRole } from '../Role/ViewRole';
import { EditRoleGlobal } from './EditRoleGlobal';
import { useRoleGlobalActions } from './useRoleGlobalActions';

export const RoleGlobalPage = () => {
  const params = useParams() as {
    roleId: string;
  };
  const role = useQuery(
    roleQueries.getOne({
      id: params.roleId,
    })
  ).data;
  const { edit } = useSearchParamsObject() as { edit?: boolean };
  const actions = useRoleGlobalActions(role);

  return (
    <PageTemplate
      constrainWidth
      title={role?.displayName || 'Role'}
      actions={<PageActions actions={omit(actions, 'View')} />}
    >
      {role ? edit ? <EditRoleGlobal role={role} /> : <ViewRole role={role} /> : null}
    </PageTemplate>
  );
};
