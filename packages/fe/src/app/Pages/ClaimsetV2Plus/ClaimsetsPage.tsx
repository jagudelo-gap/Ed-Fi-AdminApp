import { PageActions, PageTemplate, SbaaTableAllInOne } from '@edanalytics/common-ui';
import { UseQueryOptions, useQuery } from '@tanstack/react-query';
import { OnChangeFn, RowSelectionState } from '@tanstack/react-table';
import { useState } from 'react';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { NameCell } from './NameCell';
import { ClaimsetEntity, useClaimsetConfig } from './claimsetConfig';
import { useManyClaimsetActions } from './useClaimsetActions';

export const ClaimsetsPageV2 = () => {
  const [selectedRows, setSelectedRows] = useState<RowSelectionState>({});
  const actions = useManyClaimsetActions({ selectionState: selectedRows });
  return (
    <PageTemplate title="Claimsets" actions={<PageActions actions={actions} />}>
      <ClaimsetsPageContent selectedRows={selectedRows} setSelectedRows={setSelectedRows} />
    </PageTemplate>
  );
};

export const ClaimsetsPageContent = ({
  selectedRows,
  setSelectedRows,
}: {
  selectedRows: RowSelectionState;
  setSelectedRows: OnChangeFn<RowSelectionState>;
}) => {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const { queries } = useClaimsetConfig();

  // TypeScript cannot resolve union-typed overloaded functions; cast to the
  // actual return type (ClaimsetEntity = V2 | V3 DTO, same as getAll returns).
  const claimsets = useQuery(
    queries.getAll({
      teamId,
      edfiTenant,
    }) as UseQueryOptions<Record<string | number, ClaimsetEntity>>
  );

  return (
    <SbaaTableAllInOne
      enableRowSelection
      rowSelectionState={selectedRows}
      onRowSelectionChange={setSelectedRows}
      data={Object.values(claimsets?.data || {}) as ClaimsetEntity[]}
      columns={[
        {
          accessorKey: 'displayName',
          cell: NameCell,
          header: 'Name',
        },
        {
          accessorKey: '_isSystemReserved',
          header: 'Is system-reserved',
          meta: {
            type: 'options',
          },
        },
        {
          accessorKey: 'applicationsCount',
          header: 'Applications count',
          meta: {
            type: 'number',
          },
        },
      ]}
    />
  );
};
