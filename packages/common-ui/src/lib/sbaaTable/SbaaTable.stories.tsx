import { Box } from '@chakra-ui/react';
import { Meta } from '@storybook/react-vite';
import { SbaaTable, SbaaTableFilters, SbaaTablePagination, SbaaTableSearch } from '.';
import { makeData } from '../dataTable/storybook-helpers/helpers';
import { SbaaTableProvider } from './SbaaTableProvider';
import { OnChangeFn, RowSelectionState } from '@tanstack/react-table';
import { useState } from 'react';

const meta: Meta<typeof SbaaTableProvider> = {
  title: 'SbaaTable',
  component: SbaaTableProvider,
};
export default meta;

export const Standard = ({ enableRowSelection }: { enableRowSelection: boolean }) => (
  <SbaaTableProvider
    enableRowSelection={enableRowSelection}
    data={makeData(25000)}
    columns={[
      {
        accessorKey: 'firstName',
        cell: (info) => info.getValue(),
        header: 'First Name',
      },
      {
        accessorFn: (row) => row.lastName,
        id: 'lastName',
        cell: (info) => info.getValue(),
        header: 'Last Name',
      },
      {
        accessorKey: 'age',
        header: 'Age',
      },
      {
        accessorKey: 'visits',
        header: 'Visits',
        meta: {
          type: 'number',
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
      },
      {
        accessorKey: 'progress',
        header: 'Profile Progress',
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
    <Box mb={10}>
      <SbaaTableSearch />
      <SbaaTableFilters />
    </Box>
    <SbaaTable />
    <SbaaTablePagination />
  </SbaaTableProvider>
);
const data = makeData(25000);
export const ControlledSelection = () => {
  const [selectedRows, setSelectedRows] = useState<RowSelectionState>({});
  return <ExternalSelection selectedRows={selectedRows} setSelectedRows={setSelectedRows} />;
};

const ExternalSelection = ({
  selectedRows,
  setSelectedRows,
}: {
  selectedRows: RowSelectionState;
  setSelectedRows: OnChangeFn<RowSelectionState>;
}) => {
  return (
    <SbaaTableProvider
      enableRowSelection
      rowSelectionState={selectedRows}
      onRowSelectionChange={setSelectedRows}
      data={data}
      columns={[
        {
          accessorKey: 'firstName',
          cell: (info) => info.getValue(),
          header: 'First Name',
        },
        {
          accessorFn: (row) => row.lastName,
          id: 'lastName',
          cell: (info) => info.getValue(),
          header: 'Last Name',
        },
        {
          accessorKey: 'age',
          header: 'Age',
        },
        {
          accessorKey: 'visits',
          header: 'Visits',
          meta: {
            type: 'number',
          },
        },
        {
          accessorKey: 'status',
          header: 'Status',
        },
        {
          accessorKey: 'progress',
          header: 'Profile Progress',
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
      <Box mb={10}>
        <SbaaTableSearch />
        <SbaaTableFilters />
      </Box>
      <SbaaTable />
      <SbaaTablePagination />
      <pre>{JSON.stringify(selectedRows, null, 2)}</pre>
    </SbaaTableProvider>
  );
};
