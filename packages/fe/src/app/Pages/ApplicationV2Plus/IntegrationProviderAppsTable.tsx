import { ColumnDef } from '@tanstack/react-table';
import { SbaaTableAllInOne } from '@edanalytics/common-ui';
import { GetApplicationDtoV2, GetIntegrationAppDto } from '@edanalytics/models';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { useGetManyApplications } from '../../api-v2';
import { NameCell } from './NameCell';

export function IntegrationProviderAppsTable() {
  const { asId, edfiTenantId } = useTeamEdfiTenantNavContextLoaded();

  const { data: integrationProviderApps } = useGetManyApplications({
    queryArgs: { edfiTenantId, teamId: asId },
  });

  if (!integrationProviderApps) return null;

  return (
    <SbaaTableAllInOne
      data={integrationProviderApps}
      columns={[
        {
          header: 'Name',
          accessorKey: 'applicationName',
          cell: NameCell as ColumnDef<GetApplicationDtoV2 & GetIntegrationAppDto>['cell'],
        },
        {
          header: 'Integration Provider',
          accessorKey: 'integrationProviderName',
        },
        {
          header: 'Education Organization',
          accessorKey: 'edorgNames',
          accessorFn: (row) => row.edorgNames.join(', '),
        },
        {
          header: 'ODS',
          accessorKey: 'odsName',
        },
      ] as ColumnDef<GetApplicationDtoV2 & GetIntegrationAppDto>[]}
    />
  );
}
