import { Badge, BadgeProps, Box, Flex, IconButton, StyleProps, Text } from '@chakra-ui/react';
import { GetClaimsetSingleDtoV2, GetResourceClaimDtoV2 } from '@edanalytics/models';
import { CellContext, ColumnDef } from '@tanstack/react-table';
import uniq from 'lodash/uniq';
import { useMemo } from 'react';
import { SbaaTableAllInOne, useSbaaTableContext } from '../sbaaTable';
import { Icons } from '../Icons';

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

type ResourceClaimRow = GetResourceClaimDtoV2 & {
  actionsMap: Record<string, { default?: string; override?: string; enabled?: boolean }>;
  subRows: ResourceClaimRow[];
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
const extractActions = (rc: GetResourceClaimDtoV2): string[] => {
  return [
    ...rc.authorizationStrategyOverridesForCRUD.map((as) => as.actionName),
    ...rc._defaultAuthorizationStrategiesForCRUD.map((as) => as.actionName),
    ...rc.actions.map((a) => a.name),
    ...rc.children.flatMap(extractActions),
  ];
};
const mapRows = (rc: GetResourceClaimDtoV2) => {
  const output: ResourceClaimRow = {
    ...rc,
    actionsMap: {},
    subRows: rc.children.map(mapRows),
  };
  rc.actions.forEach((action) => {
    if (!output.actionsMap[action.name]) {
      output.actionsMap[action.name] = {};
    }
    output.actionsMap[action.name].enabled = action.enabled;
  });

  rc.authorizationStrategyOverridesForCRUD.forEach((aso) => {
    if (!output.actionsMap[aso.actionName]) {
      output.actionsMap[aso.actionName] = {};
    }
    output.actionsMap[aso.actionName].override = aso.authorizationStrategies[0]?.authStrategyName;
  });

  rc._defaultAuthorizationStrategiesForCRUD.forEach((asd) => {
    if (!output.actionsMap[asd.actionName]) {
      output.actionsMap[asd.actionName] = {};
    }
    output.actionsMap[asd.actionName].default = asd.authorizationStrategies[0]?.authStrategyName;
  });

  return output;
};
const actionSortOrder = ['Read', 'Create', 'Update', 'Delete', 'ReadChanges'];
// indexOf returns -1 for an action not in actionSortOrder, which would sort it
// before every known action (-1 < 0). Rank unrecognized actions after all known
// ones instead, with an alphabetical tie-breaker for deterministic ordering.
const actionSortRank = (action: string) => {
  const index = actionSortOrder.indexOf(action);
  return index === -1 ? actionSortOrder.length : index;
};

export const ResourceClaimsTableV2 = ({ claimset }: { claimset: GetClaimsetSingleDtoV2 }) => {
  const { data, columns } = useMemo(() => {
    // TODO this dynamic-ness is to accommodate buggy Admin API (want to include even unexpected actions). It probably ought to be hardcoded. Revisit eventually.
    const uniqueActions = uniq(claimset.resourceClaims.flatMap(extractActions)).sort(
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
      data: claimset.resourceClaims.map(mapRows),
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
