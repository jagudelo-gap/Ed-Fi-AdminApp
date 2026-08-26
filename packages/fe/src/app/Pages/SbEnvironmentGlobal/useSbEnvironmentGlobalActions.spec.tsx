import 'reflect-metadata';
import { GetSbEnvironmentDto } from '@edanalytics/models';
import { useSbEnvironmentGlobalActions } from './useSbEnvironmentGlobalActions';

jest.mock('react-router', () => ({
  useNavigate: jest.fn(),
}));

jest.mock('../../Layout/FeedbackBanner', () => ({
  usePopBanner: jest.fn(() => jest.fn()),
}));

jest.mock('../../api', () => ({
  sbEnvironmentQueriesGlobal: {
    refreshResources: jest.fn(() => ({ isPending: false, mutateAsync: jest.fn() })),
    delete: jest.fn(() => ({ isPending: false, mutateAsync: jest.fn() })),
    reloadTenants: jest.fn(() => ({ isPending: false, mutateAsync: jest.fn() })),
  },
}));

jest.mock('../../helpers', () => ({
  useAuthorize: jest.fn(() => false),
  globalOwnershipAuthConfig: jest.fn((privilege) => ({ privilege })),
  globalSbEnvironmentAuthConfig: jest.fn((id, privilege) => ({ privilege, subject: { id } })),
  popSyncBanner: jest.fn(),
}));

jest.mock('../../helpers/mutationErrCallback', () => ({
  mutationErrCallback: jest.fn(() => ({})),
}));

jest.mock('../../helpers/useSearch', () => ({
  useSearchParamsObject: jest.fn(() => ({})),
}));

jest.mock('../../../config/config', () => ({
  config: { showRequestCertification: false },
}));

import { useNavigate } from 'react-router';
import { useAuthorize } from '../../helpers';

const mockUseNavigate = useNavigate as jest.Mock;
const mockUseAuthorize = useAuthorize as jest.Mock;

const buildSbEnvironment = (version: 'v1' | 'v2' | 'v3', startingBlocks: boolean) =>
  ({
    id: 1,
    displayName: 'Test Env',
    version,
    startingBlocks,
    configPublic: {},
  }) as unknown as GetSbEnvironmentDto;

// Only `sb-environment:update` and `sb-environment:refresh-resources` are
// relevant to RefreshResources/Restart gating; every other privilege check
// (GrantOwnership, View, Delete, ...) defaults to unauthorized since those
// actions aren't under test here.
const setup = (
  sbEnvironment: GetSbEnvironmentDto,
  auth: { canUpdate?: boolean; canRefreshResources?: boolean } = {}
) => {
  const { canUpdate = false, canRefreshResources = false } = auth;
  mockUseNavigate.mockReturnValue(jest.fn());
  mockUseAuthorize.mockImplementation((cfg?: { privilege: string }) => {
    if (cfg?.privilege === 'sb-environment:update') return canUpdate;
    if (cfg?.privilege === 'sb-environment:refresh-resources') return canRefreshResources;
    return false;
  });
  return useSbEnvironmentGlobalActions(sbEnvironment);
};

describe('useSbEnvironmentGlobalActions', () => {
  afterEach(() => jest.clearAllMocks());

  describe('RefreshResources ("Sync Resources")', () => {
    it('is absent for a v1 tenant even when authorized and not startingBlocks-managed', () => {
      const actions = setup(buildSbEnvironment('v1', false), { canRefreshResources: true });
      expect(actions.RefreshResources).toBeUndefined();
    });

    it('is present for a v2 tenant when authorized and not startingBlocks-managed', () => {
      const actions = setup(buildSbEnvironment('v2', false), { canRefreshResources: true });
      expect(actions.RefreshResources).toBeDefined();
    });

    it('is present for a v3 tenant when authorized and not startingBlocks-managed', () => {
      const actions = setup(buildSbEnvironment('v3', false), { canRefreshResources: true });
      expect(actions.RefreshResources).toBeDefined();
    });

    it('is absent when the tenant is startingBlocks-managed, regardless of version', () => {
      const actions = setup(buildSbEnvironment('v2', true), { canRefreshResources: true });
      expect(actions.RefreshResources).toBeUndefined();
    });

    it('is absent when the user lacks refresh-resources authorization', () => {
      const actions = setup(buildSbEnvironment('v2', false), { canRefreshResources: false });
      expect(actions.RefreshResources).toBeUndefined();
    });
  });

  describe('Restart ("Reload tenants") — intentionally v2-only', () => {
    // The backend "reload tenants" capability (tenantMgmtService.reload in
    // starting-blocks.v2.service.ts) has no v3 equivalent yet. Do not widen
    // this to `!== 'v1'` the way RefreshResources was — that would expose a
    // "Reload tenants" action for v3 tenants the backend can't fulfill.
    // Version alone gates this off for v1/v3 regardless of startingBlocks,
    // so there's no need to cross startingBlocks with every non-v2 version.

    it('is present for a v2, startingBlocks-managed tenant when authorized', () => {
      const actions = setup(buildSbEnvironment('v2', true), { canUpdate: true });
      expect(actions.Restart).toBeDefined();
    });

    it('is absent for a v1 tenant even when startingBlocks-managed and authorized', () => {
      const actions = setup(buildSbEnvironment('v1', true), { canUpdate: true });
      expect(actions.Restart).toBeUndefined();
    });

    it('is absent for a v3 tenant even when startingBlocks-managed and authorized', () => {
      const actions = setup(buildSbEnvironment('v3', true), { canUpdate: true });
      expect(actions.Restart).toBeUndefined();
    });

    it('is absent for a v2 tenant that is not startingBlocks-managed', () => {
      const actions = setup(buildSbEnvironment('v2', false), { canUpdate: true });
      expect(actions.Restart).toBeUndefined();
    });

    it('is absent when the user lacks update authorization, even for v2 + startingBlocks', () => {
      const actions = setup(buildSbEnvironment('v2', true), { canUpdate: false });
      expect(actions.Restart).toBeUndefined();
    });
  });
});
