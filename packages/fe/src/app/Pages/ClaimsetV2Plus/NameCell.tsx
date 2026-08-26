import { HStack } from '@chakra-ui/react';
import { TableRowActions } from '@edanalytics/common-ui';
import { UseQueryOptions, useQuery } from '@tanstack/react-query';
import { CellContext } from '@tanstack/react-table';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { ClaimsetLinkV2 } from '../../routes';
import { ClaimsetEntity, useClaimsetConfig } from './claimsetConfig';
import { useClaimsetActions } from './useClaimsetActions';

export const NameCell = (info: CellContext<ClaimsetEntity, unknown>) => {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const { queries } = useClaimsetConfig();
  // TypeScript cannot resolve union-typed overloaded functions; cast to the
  // actual return type (ClaimsetEntity = V2 | V3 DTO, same as getAll returns).
  // Same workaround as ClaimsetsPage.tsx's `claimsets` query.
  const entities = useQuery(
    queries.getAll({
      teamId,
      edfiTenant,
    }) as UseQueryOptions<Record<string | number, ClaimsetEntity>>
  );

  const actions = useClaimsetActions({
    claimset: info.row.original,
  });
  return (
    <HStack justify="space-between">
      <ClaimsetLinkV2 id={info.row.original.id} query={entities} />
      <TableRowActions actions={actions} />
    </HStack>
  );
};
