import {
  ChakraComponent,
  Checkbox,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  chakra,
} from '@chakra-ui/react';
import { type Row, flexRender } from '@tanstack/react-table';
import { useSbaaTableContext } from './SbaaTableProvider';
import { Icons } from '../Icons';

type TableComponent = ChakraComponent<'table', { isFixedHeightForPagination?: boolean }>;

export const SbaaTable: TableComponent = (props) => {
  const { children: _children, isFixedHeightForPagination = false, ...rest } = props;
  const { table, isRowSelectionEnabled } = useSbaaTableContext();
  if (!table) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return null as any;
  }

  // If isFixedHeightForPagination is true, then we need to add empty rows to fill the page.
  // This is to prevent layout shift when a table is above other content and the pagination changes
  const { pageIndex, pageSize } = table.getState().pagination;
  const rows = table.getRowModel().rows;
  // If pageIndex is 0, then there are no empty rows.
  // Empty rows are only needed if on a later page.
  const emptyRowCount = pageIndex === 0 ? 0 : pageSize - rows.length;
  const emptyRows = [...Array(emptyRowCount).keys()].map((i) => ({
    id: `empty-${i}`,
  })) as Row<unknown>[];
  const columnCount = table.getAllColumns().length;

  return (
    <Table {...rest}>
      <Thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <Tr key={headerGroup.id}>
            {isRowSelectionEnabled ? (
              <Th w="1rem">
                <Checkbox
                  borderColor="gray.300"
                  isChecked={table.getIsAllRowsSelected()}
                  onChange={() => table.toggleAllRowsSelected()}
                  isIndeterminate={table.getIsSomeRowsSelected()}
                />
              </Th>
            ) : null}
            {headerGroup.headers.map((header) => {
              return (
                <Th
                  key={header.id}
                  colSpan={header.colSpan}
                  cursor={header.column.getCanSort() ? 'pointer' : 'default'}
                  onClick={header.column.getToggleSortingHandler()}
                  userSelect="none"
                >
                  {header.isPlaceholder ? null : (
                    <>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{
                        asc: <>&nbsp;&#9650;</>,
                        desc: <>&nbsp;&#9660;</>,
                      }[header.column.getIsSorted() as string] ?? (
                        <chakra.span visibility="hidden">&nbsp;&#9660;</chakra.span>
                      )}
                      {header.column.getIsFiltered() ? (
                        <>
                          &nbsp;
                          <Icons.Funnel fontSize="xs" mb="-2px" />
                        </>
                      ) : (
                        <chakra.span visibility="hidden">&nbsp;&#9660;</chakra.span>
                      )}
                    </>
                  )}
                </Th>
              );
            })}
          </Tr>
        ))}
      </Thead>
      <Tbody>
        {rows.map((row) => {
          return (
            <Tr key={row.id}>
              {isRowSelectionEnabled ? (
                <Td>
                  <Checkbox isChecked={row.getIsSelected()} onChange={() => row.toggleSelected()} />
                </Td>
              ) : null}
              {row.getVisibleCells().map((cell) => {
                return (
                  <Td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</Td>
                );
              })}
            </Tr>
          );
        })}
        {isFixedHeightForPagination &&
          emptyRows.map((row) => (
            <Tr key={row.id} className="group">
              <Td
                colSpan={columnCount}
                _groupHover={{ bg: 'transparent', borderColor: 'transparent' }}
              >
                &nbsp;
              </Td>
            </Tr>
          ))}
      </Tbody>
    </Table>
  );
};
