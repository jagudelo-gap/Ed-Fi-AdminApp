import { useQuery } from '@tanstack/react-query';
import { HStack } from '@chakra-ui/react';
import { TableRowActions } from '@edanalytics/common-ui';
import { GetOwnershipViewDto } from '@edanalytics/models';
import { CellContext } from '@tanstack/react-table';
import { ownershipQueries } from '../../api';
import { OwnershipGlobalLink } from '../../routes';
import { useOwnershipGlobalActions } from './useOwnershipGlobalActions';

export const OwnershipsNameCell = (info: CellContext<GetOwnershipViewDto, unknown>) => {
  const ownerships = useQuery(ownershipQueries.getAll({}));
  const actions = useOwnershipGlobalActions(info.row.original);
  return (
    <HStack justify="space-between">
      <OwnershipGlobalLink id={info.row.original.id} query={ownerships} />
      <TableRowActions actions={actions} />
    </HStack>
  );
};
