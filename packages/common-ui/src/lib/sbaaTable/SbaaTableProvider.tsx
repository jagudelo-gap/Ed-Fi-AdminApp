import { ChakraComponent, useBoolean } from '@chakra-ui/react';
import {
  ColumnDef,
  ColumnFiltersState,
  RowSelectionState,
  Table as TrtTable,
  OnChangeFn,
  getCoreRowModel,
  getFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  ExpandedState,
  getExpandedRowModel,
  TableState,
} from '@tanstack/react-table';
import React, { createContext, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import {
  fuzzyFilter,
  getColumnFilterParam,
  getGlobalFilterParam,
  getPaginationParams,
  getSortParams,
  setColumnFilterParam,
  setGlobalFilterParam,
  setPaginationParams,
  setSortParams,
} from '../dataTable';

export const SbaaTableContext = createContext<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: TrtTable<any> | null;
  pageSizes: number[];
  pendingFilterColumn: string | boolean;
  setPendingFilterColumn: (colId: string | boolean) => void;
  isRowSelectionEnabled?: boolean;
  showSettings: readonly [
    boolean,
    {
      on: () => void;
      off: () => void;
      toggle: () => void;
    }
  ];
}>({
  table: null,
  pageSizes: [10, 25, 50, 100],
  pendingFilterColumn: false,
  isRowSelectionEnabled: false,
  setPendingFilterColumn: () => false,
  showSettings: [false, { on: () => undefined, off: () => undefined, toggle: () => undefined }],
});

export const useSbaaTableContext = () => React.useContext(SbaaTableContext);
export type DivComponent = ChakraComponent<'div'>;

/** Diff old and new URLSearchParams */
export const diffSearchParams = (oldParams: URLSearchParams, newParams: URLSearchParams) => {
  let changed = false;
  for (const [key, value] of newParams) {
    if (oldParams.get(key) !== value) {
      changed = true;
      break;
    }
  }
  for (const [key, value] of oldParams) {
    if (newParams.get(key) !== value) {
      changed = true;
      break;
    }
  }

  return changed;
};

export function SbaaTableProvider<
  UseSubRows extends boolean,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends UseSubRows extends true ? { id: any; subRows: T[] } : { id: any }
>(props: {
  useSubRows?: UseSubRows;
  children?: React.ReactNode;
  data: T[] | IterableIterator<T>;
  columns: ColumnDef<T>[];
  enableRowSelection?: boolean;
  rowSelectionState?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState> | undefined;
  pageSizes?: number[];
  queryKeyPrefix?: string | undefined;
  state?: Partial<TableState>;
  isFixedHeightForPagination?: boolean;
}) {
  const data = useMemo(() => [...props.data], [props.data]);
  const columns = props.columns;
  const pageSizes = props.pageSizes ?? [10, 25, 50, 100];
  const [_searchParams, _setSearchParams] = useSearchParams();
  // detach mutations which ruin diff
  const searchParams = new URLSearchParams(_searchParams);

  const setSearchParams = (newValue: URLSearchParams) => {
    if (diffSearchParams(_searchParams, newValue)) {
      _setSearchParams(newValue);
    }
  };

  const columnFilters = getColumnFilterParam(searchParams, props.queryKeyPrefix);
  const setColumnFilters = (
    updater: ColumnFiltersState | ((old: ColumnFiltersState) => ColumnFiltersState)
  ) => {
    if (typeof updater === 'function') {
      setSearchParams(
        setColumnFilterParam(updater(columnFilters), searchParams, props.queryKeyPrefix)
      );
    } else {
      setSearchParams(setColumnFilterParam(updater, searchParams, props.queryKeyPrefix));
    }
  };
  const [pendingFilterColumn, setPendingFilterColumn] = React.useState<string | boolean>(false);

  const globalFilter = getGlobalFilterParam(searchParams, props.queryKeyPrefix);
  const setGlobalFilter = (value: string | undefined) => {
    setSearchParams(
      setGlobalFilterParam(value === '' ? undefined : value, searchParams, props.queryKeyPrefix)
    );
  };
  const sortParams = getSortParams(searchParams, props.queryKeyPrefix);

  const paginationParams = getPaginationParams(searchParams, pageSizes[0], props.queryKeyPrefix);

  const showSettings = useBoolean(sortParams.length > 1 || columnFilters.length > 0);

  const [expanded, setExpanded] = React.useState<ExpandedState>({});

  const table = useReactTable({
    data,
    columns,
    filterFns: {
      fuzzy: fuzzyFilter,
    },
    state: {
      sorting: sortParams.length > 0 ? sortParams : props.state?.sorting ?? [],
      globalFilter,
      columnFilters,
      ...(props.rowSelectionState ? { rowSelection: props.rowSelectionState } : {}),
      expanded,
      pagination: paginationParams,
    },
    getSubRows: props.useSubRows ? (row) => row.subRows : undefined,
    filterFromLeafRows: true,
    onExpandedChange: setExpanded,
    onSortingChange: (updater) =>
      setSearchParams(
        setSortParams(
          typeof updater === 'function' ? updater(sortParams) : updater,
          searchParams,
          props.queryKeyPrefix
        )
      ),
    onPaginationChange: (updater) =>
      setSearchParams(
        setPaginationParams(
          typeof updater === 'function' ? updater(paginationParams) : updater,
          searchParams,
          pageSizes[0],
          props.queryKeyPrefix
        )
      ),
    globalFilterFn: fuzzyFilter,
    ...(props.onRowSelectionChange ? { onRowSelectionChange: props.onRowSelectionChange } : {}),
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    getExpandedRowModel: props.useSubRows ? getExpandedRowModel() : undefined,
    enableMultiRowSelection: props.enableRowSelection,
    getRowId: (row) => row.id,
    enableMultiSort: true,
    debugTable: false,
    autoResetPageIndex: false,
    initialState: {
      pagination: {
        pageSize: pageSizes[0],
      },
    },
  });

  useEffect(() => {
    if (table.getState().pagination.pageIndex > table.getPageCount() - 1) {
      table.setPageIndex(table.getPageCount() - 1);
    }
  });

  return (
    <SbaaTableContext.Provider
      value={{
        table,
        pageSizes,
        pendingFilterColumn,
        setPendingFilterColumn,
        isRowSelectionEnabled: props.enableRowSelection,
        showSettings,
      }}
    >
      {props.children}
    </SbaaTableContext.Provider>
  );
}
