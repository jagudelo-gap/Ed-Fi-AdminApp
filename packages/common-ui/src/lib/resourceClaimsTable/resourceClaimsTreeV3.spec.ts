import { GetResourceClaimDtoV3 } from '@edanalytics/models';
import { extractActions, groupByParent, mapRows } from './resourceClaimsTreeV3';

const rc = (overrides: Partial<GetResourceClaimDtoV3> = {}): GetResourceClaimDtoV3 =>
  ({
    name: overrides.claimName ?? 'unnamed',
    claimName: 'unnamed',
    parentClaimName: null,
    actions: [],
    authorizationStrategyOverrides: [],
    _defaultAuthorizationStrategies: [],
    ...overrides,
  } as GetResourceClaimDtoV3);

describe('groupByParent', () => {
  it('groups resource claims by their parentClaimName', () => {
    const root = rc({ claimName: 'root', parentClaimName: null });
    const childA = rc({ claimName: 'childA', parentClaimName: 'root' });
    const childB = rc({ claimName: 'childB', parentClaimName: 'root' });
    const grandchild = rc({ claimName: 'grandchild', parentClaimName: 'childA' });

    const byParent = groupByParent([root, childA, childB, grandchild]);

    expect(byParent.get(null)).toEqual([root]);
    expect(byParent.get('root')).toEqual([childA, childB]);
    expect(byParent.get('childA')).toEqual([grandchild]);
    expect(byParent.get('childB')).toBeUndefined();
  });

  it('returns an empty map for an empty list', () => {
    expect(groupByParent([]).size).toBe(0);
  });
});

describe('extractActions', () => {
  it('collects action names from overrides, defaults, and direct actions', () => {
    const claim = rc({
      claimName: 'root',
      actions: [{ name: 'Read', enabled: true }],
      authorizationStrategyOverrides: [
        { actionName: 'Create', authorizationStrategies: [{ authStrategyName: 'Override' }] },
      ],
      _defaultAuthorizationStrategies: [
        { actionName: 'Update', authorizationStrategies: [{ authStrategyName: 'Default' }] },
      ],
    });
    const byParent = groupByParent([claim]);

    expect(extractActions(claim, byParent).sort()).toEqual(['Create', 'Read', 'Update'].sort());
  });

  it('recurses into children so descendant-only actions are still collected', () => {
    const root = rc({ claimName: 'root', actions: [{ name: 'Read', enabled: true }] });
    const child = rc({
      claimName: 'child',
      parentClaimName: 'root',
      actions: [{ name: 'Delete', enabled: true }],
    });
    const byParent = groupByParent([root, child]);

    expect(extractActions(root, byParent).sort()).toEqual(['Delete', 'Read'].sort());
  });

  it('returns an empty array for a leaf claim with no actions or strategies', () => {
    const leaf = rc({ claimName: 'leaf' });
    const byParent = groupByParent([leaf]);

    expect(extractActions(leaf, byParent)).toEqual([]);
  });
});

describe('mapRows', () => {
  it('builds a row with actionsMap entries reflecting enabled/override/default', () => {
    const claim = rc({
      claimName: 'root',
      name: 'Root',
      actions: [
        { name: 'Read', enabled: true },
        { name: 'Delete', enabled: false },
      ],
      authorizationStrategyOverrides: [
        { actionName: 'Read', authorizationStrategies: [{ authStrategyName: 'OverrideStrategy' }] },
      ],
      _defaultAuthorizationStrategies: [
        { actionName: 'Read', authorizationStrategies: [{ authStrategyName: 'DefaultStrategy' }] },
      ],
    });
    const byParent = groupByParent([claim]);

    const row = mapRows(claim, byParent);

    expect(row.id).toBe('root');
    expect(row.subRows).toEqual([]);
    expect(row.actionsMap.Read).toEqual({
      enabled: true,
      override: 'OverrideStrategy',
      default: 'DefaultStrategy',
    });
    expect(row.actionsMap.Delete).toEqual({ enabled: false });
  });

  it('recursively maps children into subRows', () => {
    const root = rc({ claimName: 'root' });
    const child = rc({ claimName: 'child', parentClaimName: 'root' });
    const byParent = groupByParent([root, child]);

    const row = mapRows(root, byParent);

    expect(row.subRows).toHaveLength(1);
    expect(row.subRows[0].id).toBe('child');
  });
});
