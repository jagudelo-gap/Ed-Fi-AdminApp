import {
  PageActions,
  PageTemplate,
  SbaaTableAllInOne,
} from '@edanalytics/common-ui';
import { Badge } from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { NameCell } from './NameCell';
import { useMultiApiClientsActions } from './useApiClientActions';
import { apiClientQueriesV2 } from '../../api';
import { useParams } from 'react-router-dom';

export const ApiClientsPageV2 = () => {
  return (
    <PageTemplate title="Credentials" actions={<ApiClientsPageActions />}>
      <AllApiClientsTable />
    </PageTemplate>
  );
};

export const ApiClientsPageActions = () => {
  const params = useParams() as { applicationId: string };
  const { asId } = useTeamEdfiTenantNavContextLoaded();

  const actions = useMultiApiClientsActions({
    teamId: asId,
    applicationId: Number(params.applicationId),
  });
  return <PageActions actions={actions} />;
};

export const AllApiClientsTable = () => {
  const params = useParams() as { applicationId: string; };

  const { edfiTenant, asId } = useTeamEdfiTenantNavContextLoaded();

  const apiClients = useQuery(
    apiClientQueriesV2.getAll(
      {
        teamId: asId,
        edfiTenant,
      },
      {
        applicationId: Number(params.applicationId),
      }
    )
  );
  return (
    <SbaaTableAllInOne
      data={Object.values(apiClients?.data || {})}
      columns={[
        {
          accessorKey: 'name',
          cell: NameCell,
          header: 'Name',
        },
        {
          accessorKey: 'key',
          header: 'Key',
        },
        {
          accessorKey: 'isApproved',
          header: 'Enabled',
          cell: (info) => (
            <Badge colorScheme={info.row.original.isApproved ? 'green' : 'red'}>
              {info.row.original.isApproved ? 'Enabled' : 'Disabled'}
            </Badge>
          ),
        },
        {
          accessorKey: 'keyStatus',
          header: 'Status',
        }
      ]}
    />
  );
};