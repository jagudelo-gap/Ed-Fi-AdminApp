import { HStack } from '@chakra-ui/react';
import { TableRowActions } from '@edanalytics/common-ui';
import { GetApiClientDtoV2 } from '@edanalytics/models';
import { CellContext } from '@tanstack/react-table';
import omit from 'lodash/omit';
import { useSingleApiClientActions } from './useApiClientActions';
import { ApiClientLinkV2 } from '../../routes/apiClients.routes';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { apiClientQueriesV2 } from '../../api';
import { useQuery } from '@tanstack/react-query';

export const NameCell = (
  info: CellContext<GetApiClientDtoV2, unknown>
) => {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const apiClients = useQuery(
    apiClientQueriesV2.getAll(
      {
        teamId,
        edfiTenant,
      },
      {
        applicationId: info.row.original.applicationId,
      }
    )
  );
  const actions = useSingleApiClientActions({
    apiClient: info.row.original,
    applicationId: info.row.original.applicationId,
  });
  return (
    <HStack justify="space-between">
      <ApiClientLinkV2 id={info.row.original.id} applicationId={info.row.original.applicationId} query={apiClients} />
      <TableRowActions actions={omit(actions, 'Create')} />
    </HStack>
  );
};
