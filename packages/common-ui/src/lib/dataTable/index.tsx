import { Input, InputProps, forwardRef } from '@chakra-ui/react';
import { ColumnFiltersState, FilterFn, PaginationState, SortingState } from '@tanstack/react-table';
import React from 'react';

import { Ranking, rankItem } from '@tanstack/match-sorter-utils';

// Threshold is set at 1.8 which means the characters should be closer together
// https://github.com/TanStack/table/blob/main/packages/match-sorter-utils/src/index.ts#L147
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
  // Rank the item
  const itemRank = rankItem(row.getValue(columnId), value, { threshold: 1.8 as Ranking });

  // Store the itemRank info
  addMeta({
    itemRank,
  });

  // Return if the item should be filtered in/out
  return itemRank.passed;
};

export const getPaginationParams = (
  searchParams: URLSearchParams,
  defaultPageSize: number,
  prefix?: string | undefined
): PaginationState => {
  const pageSizeName = getPrefixedName('pageSize', prefix);
  const pageIndexName = getPrefixedName('pageIndex', prefix);

  const pageSize = searchParams.get(pageSizeName);
  const pageIndex = searchParams.get(pageIndexName);
  return {
    pageSize: pageSize ? Number(pageSize) : defaultPageSize,
    pageIndex: pageIndex ? Number(pageIndex) : 0,
  };
};
export const getSortParams = (
  searchParams: URLSearchParams,
  prefix?: string | undefined
): SortingState => {
  const sortColName = getPrefixedName('sortCol', prefix);
  const sortDescName = getPrefixedName('sortDesc', prefix);

  const cols = searchParams.getAll(sortColName);
  const isDescs = searchParams.getAll(sortDescName).map((isDesc) => isDesc === 'true');
  if (cols.length === isDescs.length) {
    return cols.map((col, i) => ({
      desc: isDescs[i],
      id: col,
    }));
  } else {
    console.warn('Failed to parse table-sorting state from URL.');
    return [];
  }
};
export const getGlobalFilterParam = (
  searchParams: URLSearchParams,
  prefix?: string | undefined
): string | undefined => {
  const paramName = getPrefixedName('search', prefix);

  return searchParams.get(paramName) ?? undefined;
};

export const getPrefixedName = (name: string, prefix?: string | undefined) =>
  prefix?.concat('_', name) ?? name;

export const getColumnFilterParam = (
  searchParams: URLSearchParams,
  prefix?: string | undefined
): ColumnFiltersState => {
  const paramName = getPrefixedName('colfilter', prefix);
  const paramValue = searchParams.get(paramName);
  try {
    return paramValue
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        JSON.parse(atob(decodeURIComponent(paramValue))).map((item: { i: string; v: any }) => ({
          id: item.i,
          value: item.v,
        }))
      : [];
  } catch (_parsingError) {
    return [];
  }
};

export const setPaginationParams = (
  state: PaginationState,
  searchParams: URLSearchParams,
  defaultPageSize: number,
  prefix?: string | undefined
) => {
  const pageSizeName = getPrefixedName('pageSize', prefix);
  const pageIndexName = getPrefixedName('pageIndex', prefix);
  searchParams.delete(pageSizeName);
  searchParams.delete(pageIndexName);
  if (state.pageSize !== defaultPageSize) {
    searchParams.set(pageSizeName, String(state.pageSize));
  }
  if (state.pageIndex !== 0) {
    searchParams.set(pageIndexName, String(state.pageIndex));
  }
  return searchParams;
};
export const setGlobalFilterParam = (
  state: string | undefined,
  searchParams: URLSearchParams,
  prefix?: string | undefined
) => {
  const paramName = getPrefixedName('search', prefix);
  searchParams.delete(paramName);
  if (state) {
    searchParams.set(paramName, state);
  }
  return searchParams;
};
export const stringifyColumnFilters = (state: ColumnFiltersState) =>
  btoa(JSON.stringify(state.map((item) => ({ i: item.id, v: item.value }))));
export const setColumnFilterParam = (
  state: ColumnFiltersState,
  searchParams: URLSearchParams,
  prefix?: string | undefined
) => {
  const paramName = getPrefixedName('colfilter', prefix);
  searchParams.delete(paramName);
  if (state.length) {
    searchParams.set(paramName, stringifyColumnFilters(state));
  }
  return searchParams;
};

export const setSortParams = (
  state: SortingState,
  searchParams: URLSearchParams,
  prefix?: string | undefined
) => {
  const sortColName = getPrefixedName('sortCol', prefix);
  const sortDescName = getPrefixedName('sortDesc', prefix);
  searchParams.delete(sortColName);
  searchParams.delete(sortDescName);

  state.forEach((sort) => {
    searchParams.append(sortColName, String(sort.id));
    searchParams.append(sortDescName, String(sort.desc));
  });
  return searchParams;
};

export const DebouncedInput = forwardRef<
  InputProps & {
    /** (ms) */
    debounce?: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onChange: (value: any) => void;
  },
  'input'
>(({ value: initialValue, onChange, debounce = 500, ...otherProps }, ref) => {
  const [value, setValue] = React.useState(initialValue);

  React.useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      onChange(value);
    }, debounce);

    return () => clearTimeout(timeout);
    // debounce and onChange intentionally omitted: onChange is often a fresh
    // reference each render from the parent, and including it (or debounce)
    // here would reset/reschedule the debounce timer on every parent render
    // instead of only when the input value changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Input ref={ref} {...otherProps} value={value} onChange={(e) => setValue(e.target.value)} />
  );
});
