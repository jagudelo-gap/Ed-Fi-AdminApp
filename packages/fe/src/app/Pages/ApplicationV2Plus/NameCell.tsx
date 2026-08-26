import { HStack, Link } from '@chakra-ui/react';
import { TableRowActions } from '@edanalytics/common-ui';
import { CellContext } from '@tanstack/react-table';

import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { Link as RouterLink } from 'react-router';
import { useSingleApplicationActions } from './useApplicationActions';
import { ApplicationEntity } from './applicationConfig';

export const NameCell = (info: CellContext<ApplicationEntity, unknown>) => {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const actions = useSingleApplicationActions({
    application: info.row.original,
  });
  return (
    <HStack justify="space-between">
      <Link as="span">
        <RouterLink
          title="Go to application"
          to={`/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/applications/${info.row.original.id}`}
        >
          {info.row.original.applicationName}
        </RouterLink>
      </Link>
      <TableRowActions actions={actions} />
    </HStack>
  );
};
