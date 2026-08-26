import 'reflect-metadata';
import { CreateApplicationPageV2 } from './CreateApplicationPage';

jest.mock('react', () => ({ ...jest.requireActual('react'), useMemo: (factory: () => unknown) => factory() }));

import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavToParent, useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { useApplicationConfig } from './applicationConfig';

jest.mock('@edanalytics/common-ui', () => ({
  PageTemplate: ({ children }: { children: React.ReactNode }) => children,
  Icons: { Delete: () => null, InfoCircle: () => null },
}));
jest.mock('react-router', () => ({ useNavigate: jest.fn() }));
jest.mock('react-hook-form', () => ({ useForm: jest.fn() }));
jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn(), useQueryClient: jest.fn() }));
jest.mock('@hookform/resolvers/class-validator', () => ({ classValidatorResolver: jest.fn((Dto) => Dto) }));
jest.mock('../../Layout/FeedbackBanner', () => ({ usePopBanner: jest.fn(() => jest.fn()) }));
jest.mock('../../helpers', () => ({
  useNavToParent: jest.fn(() => '/parent'),
  useTeamEdfiTenantNavContextLoaded: jest.fn(),
  getRelationDisplayName: jest.fn(() => '-'),
}));
jest.mock('../../helpers/mutationErrCallback', () => ({ mutationErrCallback: jest.fn(() => ({})) }));
jest.mock('../../helpers/EntitySelectors', () => ({
  SelectClaimsetV2: () => null,
  SelectEdorg: () => null,
  SelectOds: () => null,
  SelectProfile: () => null,
  SelectVendorV2: () => null,
}));
// Prefixed with `mock` so jest's hoisting allows referencing it inside the
// factories below; lets tests assert on / control the ODS-reconciliation
// PUT independently of whichever `odsQueries` import consumes it.
const mockUpdateOdsMutateAsync = jest.fn();
jest.mock('../../api', () => ({
  edorgQueries: { getAll: jest.fn(() => 'EDORGS_QUERY') },
  profileQueriesV2: { getAll: jest.fn(() => 'PROFILES_QUERY') },
  odsQueries: {
    getAll: jest.fn(() => 'APP_ODS_QUERY'),
    put: jest.fn(() => ({ mutateAsync: mockUpdateOdsMutateAsync })),
  },
}));
jest.mock('../../api/queries/queries.v7', () => ({
  odsInstancesV2: { getAll: jest.fn(() => 'ODS_INSTANCES_V2_ADMIN_QUERY') },
  dataStoresV3: { getAll: jest.fn(() => 'DATASTORES_V3_ADMIN_QUERY') },
}));
jest.mock('../../api-v2', () => ({ QUERY_KEYS: { edfiTenants: 'edfiTenants', applications: 'applications', integrationProviders: 'integrationProviders', integrationApps: 'integrationApps' } }));
jest.mock('./applicationConfig', () => ({ useApplicationConfig: Object.assign(jest.fn(), { match: jest.fn() }) }));
jest.mock('../Ods/useOdsTerminology', () => ({
  useOdsTerminology: jest.fn(() => ({ singular: 'ODS', plural: 'Ods', listTitle: 'ODS', createTitle: 'Create ODS' })),
}));

const mockUseForm = useForm as jest.Mock;
const mockUseNavigate = useNavigate as jest.Mock;
const mockUseQuery = useQuery as jest.Mock;
const mockUseQueryClient = useQueryClient as jest.Mock;
const mockUseNavToParent = useNavToParent as jest.Mock;
const mockUseNavContext = useTeamEdfiTenantNavContextLoaded as jest.Mock;
const mockMatch = useApplicationConfig.match as jest.Mock;

const getFormElement = () => {
  const outer = CreateApplicationPageV2() as React.ReactElement;
  const inner = (outer.type as (props: unknown) => React.ReactElement)(outer.props);
  return inner;
};

const setup = (version: 'v2' | 'v3', formData: Record<string, unknown>) => {
  const postMutateAsync = jest.fn().mockResolvedValue({ id: 9 });
  mockUseNavigate.mockReturnValue(jest.fn());
  mockUseNavToParent.mockReturnValue('/parent');
  mockUseQueryClient.mockReturnValue({ invalidateQueries: jest.fn() });
  mockUseQuery.mockReturnValue({ data: {} });
  mockUseNavContext.mockReturnValue({ edfiTenantId: 3, asId: 1, edfiTenant: { id: 3, sbEnvironmentId: 2 } });
  mockUseForm.mockReturnValue({
    register: jest.fn(() => ({})),
    control: {},
    watch: jest.fn(() => undefined),
    setValue: jest.fn(),
    handleSubmit: (submit: (data: Record<string, unknown>) => Promise<void>) => () => submit(formData),
    setError: jest.fn(),
    formState: { errors: {}, isSubmitting: false },
  });
  const config = {
    version,
    queries: { post: jest.fn(() => ({ mutateAsync: postMutateAsync })) },
    PostFormDto: class PostFormDtoStub {},
  };
  mockMatch.mockImplementation((handlers: Record<string, (cfg: typeof config) => unknown>) => handlers[version](config));
  return { postMutateAsync };
};

describe('CreateApplicationPageV2', () => {
  afterEach(() => jest.clearAllMocks());

  it('posts via useApplicationConfig().queries for a v2 tenant with no selected ODS', async () => {
    const { postMutateAsync } = setup('v2', { applicationName: 'App', odsInstanceId: undefined });
    const form = getFormElement();
    await form.props.children.props.onSubmit();
    expect(postMutateAsync).toHaveBeenCalled();
  });

  it('posts via useApplicationConfig().queries for a v3 tenant with no selected data store', async () => {
    const { postMutateAsync } = setup('v3', { applicationName: 'App', dataStoreId: undefined });
    const form = getFormElement();
    await form.props.children.props.onSubmit();
    expect(postMutateAsync).toHaveBeenCalled();
  });

  it('reconciles a selected data store to its Admin API id and writes it to dataStoreId (not odsInstanceId) for a v3 tenant', async () => {
    const postMutateAsync = jest.fn().mockResolvedValue({ id: 9 });
    mockUpdateOdsMutateAsync.mockResolvedValue(undefined);
    mockUseNavigate.mockReturnValue(jest.fn());
    mockUseNavToParent.mockReturnValue('/parent');
    mockUseQueryClient.mockReturnValue({ invalidateQueries: jest.fn() });
    mockUseNavContext.mockReturnValue({ edfiTenantId: 3, asId: 1, edfiTenant: { id: 3, sbEnvironmentId: 2 } });

    // The local `Ods` row selected in the form — not yet reconciled with its
    // real Admin API id.
    const localOdsRow = {
      id: 11,
      edfiTenantId: 3,
      dbName: 'db1',
      odsInstanceId: 5, // selected value, matches the form's watched dataStoreId below
      odsInstanceName: 'Local Ods',
    };
    // The V3 Admin API's own data store, matched to the local row by name.
    const adminApiDataStore = { id: 777, name: 'Local Ods', dataStoreType: 'Ods' };

    mockUseQuery.mockImplementation((query: string) => {
      if (query === 'APP_ODS_QUERY') return { data: { [localOdsRow.id]: localOdsRow } };
      if (query === 'DATASTORES_V3_ADMIN_QUERY') return { data: { [adminApiDataStore.id]: adminApiDataStore } };
      return { data: {} };
    });

    mockUseForm.mockReturnValue({
      register: jest.fn(() => ({})),
      control: {},
      watch: jest.fn((field: string) => (field === 'dataStoreId' ? 5 : undefined)),
      setValue: jest.fn(),
      handleSubmit:
        (submit: (data: Record<string, unknown>) => Promise<void>) =>
        () =>
          submit({ applicationName: 'App', dataStoreId: 5 }),
      setError: jest.fn(),
      formState: { errors: {}, isSubmitting: false },
    });

    const config = {
      version: 'v3' as const,
      queries: { post: jest.fn(() => ({ mutateAsync: postMutateAsync })) },
      PostFormDto: class PostFormDtoStub {},
    };
    mockMatch.mockImplementation((handlers: Record<string, (cfg: typeof config) => unknown>) =>
      handlers['v3'](config)
    );

    const form = getFormElement();
    await form.props.children.props.onSubmit();

    expect(mockUpdateOdsMutateAsync).toHaveBeenCalledWith({
      entity: { id: 11, edfiTenantId: 3, name: 'db1', odsInstanceId: 777 },
    });
    expect(postMutateAsync).toHaveBeenCalledWith(
      { entity: expect.objectContaining({ dataStoreId: 777 }) },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
    // The V2-only field name must never appear on a V3 payload.
    const [[submittedArgs]] = postMutateAsync.mock.calls;
    expect(submittedArgs.entity).not.toHaveProperty('odsInstanceId');
  });
});
