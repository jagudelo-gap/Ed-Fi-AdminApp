import { useState } from 'react';
import { Button, Collapse, Flex, Spinner } from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import { odsQueries } from '../../api';
import { useParams } from 'react-router';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { DateFormat, SbaaTableAllInOne, ValueAsDate } from '@edanalytics/common-ui';

export const OdsRowCountsTable = () => {
  const params = useParams() as { odsId: string };
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();

  const [hasQueriedData, setHasQueriedData] = useState(false);

  const { data, isFetching, isFetched, refetch, isRefetching } = useQuery({
    ...odsQueries.rowCounts(
      {
        edfiTenant,
        teamId,
        enabled: hasQueriedData,
      },
      params
    ),
    // Set staleTime to 0 to never refetch data unless explicitly requested
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const hasData = !!data;
  const isLoading = isFetching || isRefetching;

  const getRowCountsData = () => {
    if (!hasQueriedData) {
      setHasQueriedData(true);
      return;
    }
    refetch();
  };

  const refreshText = isRefetching ? 'Refreshing' : 'Refresh';
  const retrieveText = isFetching ? 'Retrieving' : 'Retrieve';
  const buttonVerb = hasQueriedData || hasData ? refreshText : retrieveText;
  const rowCountsData = Object.values(data ?? {});

  return (
    <>
      <Flex alignItems="center" mb={isFetched ? 4 : 0}>
        <Button onClick={getRowCountsData} mr={4} disabled={isLoading}>
          {buttonVerb} row counts
        </Button>
        {isLoading && <Spinner />}
      </Flex>
      <Collapse in={rowCountsData.length > 0} startingHeight={0}>
        <SbaaTableAllInOne
          queryKeyPrefix="odsRowCounts"
          data={rowCountsData}
          state={{ sorting: [{ id: 'lastUpdated', desc: true }] }}
          columns={[
            {
              accessorFn: (row) => `${row.Schema}.${row.Table}`,
              header: 'Table Name',
            },
            {
              accessorKey: 'RecordCount',
              header: 'Number of Rows',
            },
            {
              id: 'firstCreated',
              accessorFn: (row) => (row.FirstCreated ? new Date(row.FirstCreated) : null),
              cell: ValueAsDate({ default: DateFormat.Full }),
              header: 'Earliest Record',
            },
            {
              id: 'lastCreated',
              accessorFn: (row) => (row.LastCreated ? new Date(row.LastCreated) : null),
              cell: ValueAsDate({ default: DateFormat.Full }),
              header: 'Newest Record',
            },
            {
              id: 'lastUpdated',
              accessorFn: (row) => (row.LastUpdated ? new Date(row.LastUpdated) : null),
              cell: ValueAsDate({ default: DateFormat.Full }),
              header: 'Most Recent Update',
            },
          ]}
        />
      </Collapse>
    </>
  );
};
