import { useBoolean } from '@chakra-ui/react';
import {
  ColumnDef,
  ColumnFiltersState,
  OnChangeFn,
  RowSelectionState,
  Table,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import React, { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { SbaaTableContext, diffSearchParams } from '.';
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

export function SbaaTableProviderServerSide<
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
  rowCount: number;
  getFacetedMinMaxValues: (table: Table<T>, columnId: string) => () => undefined | [number, number];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getFacetedUniqueValues: (table: Table<T>, columnId: string) => () => Map<any, number>;
  queryKeyPrefix?: string | undefined;
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

  const table = useReactTable({
    data,
    columns,
    filterFns: {
      fuzzy: fuzzyFilter,
    },
    state: {
      sorting: sortParams,
      globalFilter,
      columnFilters,
      ...(props.rowSelectionState ? { rowSelection: props.rowSelectionState } : {}),
      pagination: paginationParams,
    },
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
    getCoreRowModel: getCoreRowModel(),
    getFacetedUniqueValues: props.getFacetedUniqueValues,
    getFacetedMinMaxValues: props.getFacetedMinMaxValues,
    getExpandedRowModel: props.useSubRows ? getExpandedRowModel() : undefined,
    enableMultiRowSelection: props.enableRowSelection,
    getRowId: (row) => row.id,
    enableMultiSort: true,
    debugTable: false,
    autoResetPageIndex: false,
    manualFiltering: true,
    manualPagination: true,
    manualSorting: true,
    pageCount: Math.ceil(props.rowCount / paginationParams.pageSize),
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
