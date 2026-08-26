import { Box, HStack } from '@chakra-ui/react';
import { Meta } from '@storybook/react-vite';
import { ColumnFiltersState, RowData, SortingState, Table } from '@tanstack/react-table';
import React from 'react';
import { useSearchParams } from 'react-router';
import {
  SbaaTable,
  SbaaTableAdvancedButton,
  SbaaTableFilters,
  SbaaTablePagination,
  SbaaTableProviderServerSide,
  SbaaTableSearch,
} from '.';
import { getColumnFilterParam, getPaginationParams, getSortParams } from '../dataTable';
import { Person, makeData } from '../dataTable/storybook-helpers/helpers';
import { SbaaTableProvider } from './SbaaTableProvider';

const meta: Meta<typeof SbaaTableProvider> = {
  title: 'SbaaTable-ServerSide',
  component: SbaaTableProvider,
};
export default meta;
const originalData = makeData(25000);
const prepData = (columnFilters: ColumnFiltersState, sort: SortingState) =>
  originalData
    .filter((p) => {
      let result = true;
      for (const column of columnFilters) {
        if (['firstName', 'lastName'].includes(column.id)) {
          if (p[column.id as keyof Person] !== column.value) result = false;
        } else {
          const value = column.value as [number | null, number | null];
          if (typeof value[0] === 'number' && (p[column.id as keyof Person] as number) <= value[0])
            result = false;
          if (typeof value[1] === 'number' && (p[column.id as keyof Person] as number) >= value[1])
            result = false;
        }
      }
      return result;
    })
    .sort((a, b) => {
      for (const sortCol of sort) {
        const col = sortCol.id as keyof Person;
        if ((a[col] ?? Infinity) < (b[col] ?? Infinity)) return sortCol.desc ? 1 : -1;
        if ((a[col] ?? Infinity) > (b[col] ?? Infinity)) return sortCol.desc ? -1 : 1;
      }
      return 0;
    });

export const Standard = ({ enableRowSelection }: { enableRowSelection: boolean }) => {
  const [searchParams] = useSearchParams();
  const columnFilters = getColumnFilterParam(searchParams, undefined);
  // const globalFilter = getGlobalFilterParam(searchParams, undefined);
  // const setGlobalFilter = (value: string | undefined) => {
  //   setSearchParams(
  //     setGlobalFilterParam(value === '' ? undefined : value, searchParams, undefined)
  //   );
  // };
  const sortParams = getSortParams(searchParams, undefined);

  const paginationParams = getPaginationParams(searchParams, undefined);
  const paginationState = {
    pageIndex: paginationParams.pageIndex ?? 0,
    pageSize: paginationParams.pageSize ?? 10,
  };

  const data = prepData(columnFilters, sortParams);
  function getFacetedMinMaxValues<TData extends RowData = Person>(): (
    table: Table<TData>,
    columnId: string
  ) => () => undefined | [number, number] {
    return (table, columnId) => {
      if (['firstName', 'lastName'].includes(columnId)) {
        return () => undefined;
      } else {
        const facetedData = prepData(
          columnFilters.filter((f) => f.id !== columnId),
          sortParams
        );
        return () => [
          Math.min(...facetedData.map((p) => p[columnId as keyof Person] as number)),
          Math.max(...facetedData.map((p) => p[columnId as keyof Person] as number)),
        ];
      }
    };
  }
  function getFacetedUniqueValues<TData extends RowData = Person>(): (
    table: Table<TData>,
    columnId: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => () => Map<any, number> {
    return (table, columnId) => {
      if (['firstName', 'lastName'].includes(columnId)) {
        const facetedData = prepData(
          columnFilters.filter((f) => f.id !== columnId),
          sortParams
        );
        const result = new Map<string, number>();
        facetedData.forEach((p) => {
          const v = p[columnId as keyof Person] as string;
          if (v === undefined) return;
          const prior = result.get(v);
          if (prior) {
            result.set(v, prior + 1);
          } else {
            result.set(v, 1);
          }
        });
        return () => result;
      } else {
        return () => new Map<number, number>();
      }
    };
  }

  return (
    <SbaaTableProviderServerSide
      getFacetedMinMaxValues={getFacetedMinMaxValues()}
      getFacetedUniqueValues={getFacetedUniqueValues()}
      enableRowSelection={enableRowSelection}
      data={data.slice(
        paginationState.pageIndex * paginationState.pageSize,
        (paginationState.pageIndex + 1) * paginationState.pageSize
      )}
      rowCount={data.length}
      columns={[
        {
          accessorKey: 'firstName',
          header: 'First Name',
          meta: {
            type: 'options',
          },
        },
        {
          accessorKey: 'lastName',
          header: 'Last Name',
          meta: {
            type: 'options',
          },
        },
        {
          accessorKey: 'age',
          header: 'Age',
          meta: {
            type: 'number',
          },
        },
        {
          accessorKey: 'createdAt',
          header: 'Created At',
          meta: {
            type: 'date',
          },
        },
      ]}
    >
      <Box mb={4}>
        <HStack align="end">
          <SbaaTableSearch />
          <SbaaTableAdvancedButton />
        </HStack>
        <SbaaTableFilters mb={4} />
      </Box>
      <SbaaTable />
      <SbaaTablePagination />
    </SbaaTableProviderServerSide>
  );
};
