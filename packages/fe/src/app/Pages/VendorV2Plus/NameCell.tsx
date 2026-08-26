import { HStack } from '@chakra-ui/react';
import { TableRowActions } from '@edanalytics/common-ui';
import { CellContext } from '@tanstack/react-table';

import { useQuery } from '@tanstack/react-query';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { VendorLinkV2 } from '../../routes';
import { useVendorActions } from './useVendorActions';
import { VendorEntity, useVendorConfig } from './vendorConfig';

export const NameCell = (info: CellContext<VendorEntity, unknown>) => {
  const { edfiTenant, teamId } = useTeamEdfiTenantNavContextLoaded();
  const { queries } = useVendorConfig();
  const vendors = useQuery(
    queries.getAll({
      teamId,
      edfiTenant,
    })
  );
  const actions = useVendorActions(info.row.original);
  return (
    <HStack justify="space-between">
      <VendorLinkV2 id={info.row.original.id} query={vendors} />
      <TableRowActions actions={actions} />
    </HStack>
  );
};
