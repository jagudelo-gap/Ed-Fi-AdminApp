import { GetResourceClaimDtoV3 } from '@edanalytics/models';

export type ResourceClaimRow = GetResourceClaimDtoV3 & {
  id: string; // claimName serves as unique identifier
  actionsMap: Record<string, { default?: string; override?: string; enabled?: boolean }>;
  subRows: ResourceClaimRow[];
};

// V3's resourceClaims arrive as a flat list joined by parentClaimName/claimName
// rather than V2's nested `children` array (see 530-design.md). Build a
// lookup once, keyed by each entry's own claimName, so both root-finding and
// child-lookup are O(1) instead of re-scanning the array per node.
export const groupByParent = (resourceClaims: GetResourceClaimDtoV3[]) => {
  const byParent = new Map<string | null, GetResourceClaimDtoV3[]>();
  resourceClaims.forEach((rc) => {
    const key = rc.parentClaimName;
    if (!byParent.has(key)) {
      byParent.set(key, []);
    }
    byParent.get(key)!.push(rc);
  });
  return byParent;
};

export const extractActions = (
  rc: GetResourceClaimDtoV3,
  byParent: Map<string | null, GetResourceClaimDtoV3[]>
): string[] => {
  const children = byParent.get(rc.claimName) ?? [];
  return [
    ...rc.authorizationStrategyOverrides.map((as) => as.actionName),
    ...rc._defaultAuthorizationStrategies.map((as) => as.actionName),
    ...rc.actions.map((a) => a.name),
    ...children.flatMap((child) => extractActions(child, byParent)),
  ];
};

export const mapRows = (
  rc: GetResourceClaimDtoV3,
  byParent: Map<string | null, GetResourceClaimDtoV3[]>
) => {
  const children = byParent.get(rc.claimName) ?? [];
  const output: ResourceClaimRow = {
    ...rc,
    id: rc.claimName,
    actionsMap: {},
    subRows: children.map((child) => mapRows(child, byParent)),
  };
  rc.actions.forEach((action) => {
    if (!output.actionsMap[action.name]) {
      output.actionsMap[action.name] = {};
    }
    output.actionsMap[action.name].enabled = action.enabled;
  });

  rc.authorizationStrategyOverrides.forEach((aso) => {
    if (!output.actionsMap[aso.actionName]) {
      output.actionsMap[aso.actionName] = {};
    }
    output.actionsMap[aso.actionName].override = aso.authorizationStrategies[0]?.authStrategyName;
  });

  rc._defaultAuthorizationStrategies.forEach((asd) => {
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
export const actionSortRank = (action: string) => {
  const index = actionSortOrder.indexOf(action);
  return index === -1 ? actionSortOrder.length : index;
};
