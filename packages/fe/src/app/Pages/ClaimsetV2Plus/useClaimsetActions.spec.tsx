import 'reflect-metadata';
import { useClaimsetActions, useManyClaimsetActions } from './useClaimsetActions';
import { useClaimsetConfig } from './claimsetConfig';
import { claimsetAuthConfig, useAuthorize, useTeamEdfiTenantNavContextLoaded } from '../../helpers';

jest.mock('@edanalytics/common-ui', () => ({
  Icons: { View: 'ViewIcon', Delete: 'DeleteIcon', Export: 'ExportIcon', Import: 'ImportIcon', Copy: 'CopyIcon' },
}));

jest.mock('@chakra-ui/react', () => ({
  Link: ({ children }: { children?: React.ReactNode }) => children,
}));

jest.mock('react-router', () => ({
  Link: () => null,
  useNavigate: jest.fn(() => jest.fn()),
}));

jest.mock('../../Layout/FeedbackBanner', () => ({
  usePopBanner: jest.fn(() => jest.fn()),
}));

jest.mock('../../api', () => ({
  API_URL: 'https://example.test/api',
}));

jest.mock('../../helpers', () => ({
  claimsetAuthConfig: jest.fn(() => ({})),
  useAuthorize: jest.fn(),
  useTeamEdfiTenantNavContextLoaded: jest.fn(),
}));

jest.mock('../../helpers/mutationErrCallback', () => ({
  mutationErrCallback: jest.fn(() => ({})),
}));

jest.mock('./claimsetConfig', () => ({
  useClaimsetConfig: jest.fn(),
}));

const mockConfig = useClaimsetConfig as unknown as jest.Mock;
const mockAuthorize = useAuthorize as jest.Mock;
const mockAuthConfig = claimsetAuthConfig as jest.Mock;
const mockNav = useTeamEdfiTenantNavContextLoaded as jest.Mock;

// Let claimsetAuthConfig's real 3rd argument (the privilege string) flow
// through to useAuthorize, instead of collapsing every call to `{}`. That way
// a test can deny exactly one privilege by inspecting which privilege
// useAuthorize was actually called with — see `denyPrivilege` below.
mockAuthConfig.mockImplementation(
  (_edfiTenantId: unknown, _teamId: unknown, privilege: string) => ({ privilege })
);

const setup = (version: 'v2' | 'v3') => {
  const createExportMutateAsync = jest.fn().mockResolvedValue({ id: 77 });
  mockAuthorize.mockReturnValue(true);
  mockNav.mockReturnValue({
    edfiTenant: { id: 3, sbEnvironmentId: 2 },
    asId: 1,
    edfiTenantId: 5,
    teamId: 1,
  });
  mockConfig.mockReturnValue({
    version,
    queries: {
      delete: jest.fn(() => ({ isPending: false, mutateAsync: jest.fn() })),
      createExport: jest.fn(() => ({ isPending: false, mutateAsync: createExportMutateAsync })),
    },
  });
  return { createExportMutateAsync };
};

// Denies exactly one privilege (identified by its claimsetAuthConfig-supplied
// suffix, e.g. 'read'/'create'/'delete') and grants every other useAuthorize
// call. A negative test built on this genuinely exercises the corresponding
// useAuthorize call — if that gate were removed from the hook, useAuthorize
// would never be called with the denied privilege and the action would wrongly
// still appear.
const denyPrivilege = (privilegeSuffix: string) => {
  mockAuthorize.mockImplementation(
    (config: { privilege?: string } | undefined) =>
      !config?.privilege?.endsWith(`:${privilegeSuffix}`)
  );
};

const claimset = { id: 9, displayName: 'SIS Vendor', _isSystemReserved: false } as never;

describe('useClaimsetActions Export', () => {
  afterEach(() => jest.clearAllMocks());

  it.each(['v2', 'v3'] as const)('exposes the Export action for %s', (version) => {
    setup(version);
    const actions = useClaimsetActions({ claimset });
    expect(actions.Export).toBeDefined();
  });

  it.each(['v2', 'v3'] as const)(
    'builds the download URL with the %s admin-api segment',
    async (version) => {
      const { createExportMutateAsync } = setup(version);
      const actions = useClaimsetActions({ claimset });
      await actions.Export!.onClick!({} as never);

      // The banner message is built in the mutation's onSuccess callback.
      const onSuccess = createExportMutateAsync.mock.calls[0][1].onSuccess;
      const popBanner = jest.requireMock('../../Layout/FeedbackBanner').usePopBanner.mock.results[0]
        .value;
      onSuccess({ id: 77 });
      const banner = popBanner.mock.calls[0][0];
      const rendered = JSON.stringify(banner.message);
      expect(rendered).toContain(`/admin-api/${version}/claimsets/export/77`);
    }
  );
});

describe('useManyClaimsetActions', () => {
  afterEach(() => jest.clearAllMocks());

  it.each(['v2', 'v3'] as const)('exposes the Import action for %s', (version) => {
    setup(version);
    const actions = useManyClaimsetActions({ selectionState: {} });
    expect(actions.Import).toBeDefined();
  });

  it.each(['v2', 'v3'] as const)(
    'exposes the bulk Export action for %s when rows are selected',
    (version) => {
      setup(version);
      const actions = useManyClaimsetActions({ selectionState: { '9': true } });
      expect(actions.Export).toBeDefined();
    }
  );
});

// Authorization is now the *only* gate on Export/Import (the old
// `version === 'v2'` gates were removed), so these negative assertions are
// the load-bearing coverage: each one is only meaningful if it actually fails
// when its corresponding useAuthorize gate is removed from the hook. Verified
// by temporarily deleting each gate locally and re-running — every test below
// failed as expected, then passed again once the gate was restored.
describe('useClaimsetActions / useManyClaimsetActions authorization denial', () => {
  afterEach(() => jest.clearAllMocks());

  it('useManyClaimsetActions does not expose Import when canCreate is false', () => {
    setup('v3');
    denyPrivilege('create');

    const actions = useManyClaimsetActions({ selectionState: {} });

    expect(actions.Import).toBeUndefined();
  });

  it('useManyClaimsetActions does not expose Export when canRead is false, even with rows selected', () => {
    setup('v3');
    denyPrivilege('read');

    const actions = useManyClaimsetActions({ selectionState: { '9': true } });

    expect(actions.Export).toBeUndefined();
  });

  it('useClaimsetActions does not expose Export when canView is false', () => {
    setup('v3');
    denyPrivilege('read');

    const actions = useClaimsetActions({ claimset });

    expect(actions.Export).toBeUndefined();
    expect(actions.View).toBeUndefined();
  });
});
