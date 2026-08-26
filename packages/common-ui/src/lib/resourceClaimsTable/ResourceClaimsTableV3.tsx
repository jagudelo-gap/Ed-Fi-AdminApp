import { Badge, BadgeProps, Box, Flex, IconButton, StyleProps, Text } from '@chakra-ui/react';
import { GetClaimsetSingleDtoV3 } from '@edanalytics/models';
import { CellContext, ColumnDef } from '@tanstack/react-table';
import uniq from 'lodash/uniq';
import { useMemo } from 'react';
import { SbaaTableAllInOne, useSbaaTableContext } from '../sbaaTable';
import { Icons } from '../Icons';
import {
  ResourceClaimRow,
  actionSortRank,
  extractActions,
  groupByParent,
  mapRows,
} from './resourceClaimsTreeV3';

const AuthStrategyBadge = (props: {
  authDefault: string | null;
  authOverride: string | null;
  hasAtAll: boolean;
}) => {
  const { authDefault, authOverride, hasAtAll } = props;
  const badgeProps: Partial<StyleProps & BadgeProps> = hasAtAll
    ? authOverride
      ? { colorScheme: 'blue' }
      : authDefault
      ? { colorScheme: 'gray', color: 'gray.600', fontStyle: 'italic' }
      : { colorScheme: 'orange' }
    : { colorScheme: 'red' };
  return (
    <Badge textTransform="none" {...badgeProps}>
      {hasAtAll ? authOverride ?? authDefault ?? 'Auth strategy unknown' : 'Denied'}
    </Badge>
  );
};

const NameHeader = () => {
  const table = useSbaaTableContext().table;
  const canAnyExpand = table?.getCanSomeRowsExpand();
  return (
    <Text as="span" pl={canAnyExpand ? '20px' : undefined}>
      Name
    </Text>
  );
};
const NameCell = (props: CellContext<ResourceClaimRow, unknown>) => {
  const table = useSbaaTableContext().table;
  const canAnyExpand = table?.getCanSomeRowsExpand();
  const canThisRowExpand = props.row.getCanExpand();

  return (
    <Box
      ml={`${props.row.depth * 1.5}rem`}
      pl={canThisRowExpand || !canAnyExpand ? undefined : '20px'}
    >
      {canThisRowExpand && (
        <IconButton
          display="inline-block"
          onClick={() => props.row.toggleExpanded()}
          aria-label="open or close"
          title="open or close"
          variant="unstyled"
          w="20px"
          h="20px"
          minH="20px"
          minW="20px"
          size="xs"
          className={props.row.getIsExpanded() ? 'opened' : undefined}
          css={{
            '&.opened': {
              transition: '0.5s',
              transform: 'rotate(90deg)',
            },
            svg: {
              margin: 'auto',
            },
          }}
          icon={<Icons.CaretRightFill />}
        />
      )}
      {props.row.original.name}
    </Box>
  );
};

export const ResourceClaimsTableV3 = ({ claimset }: { claimset: GetClaimsetSingleDtoV3 }) => {
  const { data, columns } = useMemo(() => {
    const byParent = groupByParent(claimset.resourceClaims);
    const roots = byParent.get(null) ?? [];
    // TODO this dynamic-ness is to accommodate buggy Admin API (want to include even unexpected actions). It probably ought to be hardcoded. Revisit eventually.
    const uniqueActions = uniq(roots.flatMap((rc) => extractActions(rc, byParent))).sort(
      (actionA, actionB) =>
        actionSortRank(actionA) - actionSortRank(actionB) || actionA.localeCompare(actionB)
    );
    const columns: ColumnDef<ResourceClaimRow>[] = [
      {
        accessorKey: 'name',
        header: NameHeader,
        cell: NameCell,
      },
      ...uniqueActions.map((action) => ({
        id: action,
        header: action,
        accessorFn: (rc: ResourceClaimRow) => {
          const rcAction = rc.actionsMap[action];
          return rcAction?.enabled ? rcAction.override ?? rcAction.default ?? 'Unknown' : 'Denied';
        },
        cell: (ctx: CellContext<ResourceClaimRow, unknown>) => (
          <AuthStrategyBadge
            authOverride={ctx.row.original.actionsMap[action]?.override ?? null}
            authDefault={ctx.row.original.actionsMap[action]?.default ?? null}
            hasAtAll={ctx.row.original.actionsMap[action]?.enabled ?? false}
          />
        ),
        meta: {
          type: 'options' as const,
        },
      })),
    ];
    return {
      uniqueActions,
      data: roots.map((rc) => mapRows(rc, byParent)),
      columns,
    };
  }, [claimset]);
  return (
    <>
      <SbaaTableAllInOne useSubRows data={data} columns={columns} />
      <Flex
        borderTop="1px solid"
        borderColor="gray.200"
        mt={3}
        pt={3}
        css={{
          '& span': {
            width: 'fit-content',
          },
        }}
        gap={1}
        flexDir="column"
      >
        <AuthStrategyBadge authDefault={'Default auth strategy'} authOverride={null} hasAtAll />
        <AuthStrategyBadge authOverride={'Override auth strategy'} authDefault={null} hasAtAll />
        <AuthStrategyBadge authOverride={null} authDefault={null} hasAtAll={false} />
        <AuthStrategyBadge authOverride={null} authDefault={null} hasAtAll />
      </Flex>
    </>
  );
};
