import { IconButton, ButtonGroup, HStack, Select, Text } from '@chakra-ui/react';
import { DivComponent, useSbaaTableContext } from './SbaaTableProvider';
import { Icons } from '../Icons';

export const SbaaTablePagination: DivComponent = (props) => {
  const { children: _children, ...rest } = props;
  const { table, pageSizes } = useSbaaTableContext();

  if (!table) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return null as any;
  }
  return table.getPageCount() > 1 ||
    table.getPrePaginationRowModel().rows.length > Math.min(...pageSizes) ? (
    <HStack justify="center" p={4} {...rest}>
      <ButtonGroup size="sm" variant="outline">
        <IconButton
          aria-label="First Page"
          w={8}
          borderRadius={'8em'}
          onClick={() => table.setPageIndex(0)}
          isDisabled={!table.getCanPreviousPage()}
          icon={<Icons.DoubleChevronsLeft />}
        />
        <IconButton
          aria-label="Previous Page"
          w={8}
          borderRadius={'8em'}
          onClick={() => table.previousPage()}
          isDisabled={!table.getCanPreviousPage()}
          icon={<Icons.ChevronLeft />}
        />
      </ButtonGroup>
      <Text>
        {table.getState().pagination.pageIndex + 1}&nbsp;of&nbsp;
        {table.getPageCount()}
      </Text>
      <ButtonGroup size="sm" variant="outline">
        <IconButton
          aria-label="Next Page"
          w={8}
          borderRadius={'8em'}
          onClick={() => table.nextPage()}
          isDisabled={!table.getCanNextPage()}
          icon={<Icons.ChevronRight />}
        />
        <IconButton
          aria-label="Last Page"
          w={8}
          borderRadius={'8em'}
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          isDisabled={!table.getCanNextPage()}
          icon={<Icons.DoubleChevronsRight />}
        />
      </ButtonGroup>
      <Select
        borderRadius={'8em'}
        w={'auto'}
        size="sm"
        value={table.getState().pagination.pageSize}
        onChange={(e) => {
          table.setPageSize(Number(e.target.value));
        }}
      >
        {pageSizes.map((pageSize) => (
          <option key={pageSize} value={pageSize}>
            Show {pageSize}
          </option>
        ))}
      </Select>
    </HStack>
  ) : (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (null as any)
  );
};
