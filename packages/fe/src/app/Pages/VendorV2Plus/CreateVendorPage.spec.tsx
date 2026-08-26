import 'reflect-metadata';
import { CreateVendorV2 } from './CreateVendorPage';

// CreateVendorV2 is invoked directly as a plain function below (not rendered via
// a test renderer), so React's real hook dispatcher is never installed. All other
// hooks the component calls are mocked modules (not real React hooks), but useMemo
// is imported directly from 'react' and would crash with "Cannot read properties of
// null (reading 'useMemo')" outside of an actual render. Shim it to just invoke the
// factory immediately; this does not affect any test assertions.
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useMemo: (factory: () => unknown) => factory(),
}));
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useNavToParent, useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { useVendorConfig } from './vendorConfig';

jest.mock('@edanalytics/common-ui', () => ({
  PageTemplate: ({ children }: { children: React.ReactNode }) => children,
  Icons: { InfoCircle: () => null },
}));

jest.mock('react-router', () => ({
  useNavigate: jest.fn(),
}));

jest.mock('react-hook-form', () => ({
  useForm: jest.fn(),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: jest.fn(),
}));

jest.mock('@hookform/resolvers/class-validator', () => ({
  classValidatorResolver: jest.fn((Dto) => Dto),
}));

jest.mock('../../Layout/FeedbackBanner', () => ({
  usePopBanner: jest.fn(() => jest.fn()),
}));

jest.mock('../../helpers', () => ({
  useNavToParent: jest.fn(() => '/parent'),
  useTeamEdfiTenantNavContextLoaded: jest.fn(),
}));

jest.mock('../../helpers/mutationErrCallback', () => ({
  mutationErrCallback: jest.fn(() => ({})),
}));

jest.mock('./vendorConfig', () => ({
  useVendorConfig: Object.assign(jest.fn(), { match: jest.fn() }),
}));

const mockUseForm = useForm as jest.Mock;
const mockUseNavigate = useNavigate as jest.Mock;
const mockUseQueryClient = useQueryClient as jest.Mock;
const mockUseNavToParent = useNavToParent as jest.Mock;
const mockUseTeamEdfiTenantNavContextLoaded = useTeamEdfiTenantNavContextLoaded as jest.Mock;
const mockMatch = useVendorConfig.match as jest.Mock;

// CreateVendorV2 now dispatches via `.match()` to a per-version
// `CreateVendorForm`, so getting to the actual <form> requires invoking that
// inner component too (same "call as a plain function" approach as
// CreateVendorV2 itself, one level deeper).
const getFormElement = () => {
  const outer = CreateVendorV2() as React.ReactElement;
  const inner = (outer.type as (props: unknown) => React.ReactElement)(outer.props);
  return inner.props.children.props.children as React.ReactElement;
};

const setup = (version: 'v2' | 'v3', formData: Record<string, unknown>) => {
  const postMutateAsync = jest.fn();
  mockUseNavigate.mockReturnValue(jest.fn());
  mockUseNavToParent.mockReturnValue('/parent');
  mockUseQueryClient.mockReturnValue({ invalidateQueries: jest.fn() });
  mockUseTeamEdfiTenantNavContextLoaded.mockReturnValue({
    teamId: 1,
    edfiTenant: { id: 3, sbEnvironmentId: 2 },
    edfiTenantId: 3,
  });
  mockUseForm.mockReturnValue({
    register: jest.fn(() => ({})),
    control: {},
    handleSubmit: (submit: (data: Record<string, unknown>) => Promise<void>) => () => submit(formData),
    setError: jest.fn(),
    formState: { errors: {}, isSubmitting: false },
  });
  postMutateAsync.mockResolvedValue({ id: 9 });
  const config = {
    version,
    queries: { post: jest.fn(() => ({ mutateAsync: postMutateAsync })) },
    PostDto: class PostDtoStub {},
  };
  mockMatch.mockImplementation((handlers: Record<string, (cfg: typeof config) => unknown>) =>
    handlers[version](config)
  );
  return { postMutateAsync };
};

describe('CreateVendorV2', () => {
  afterEach(() => jest.clearAllMocks());

  it('posts via useVendorConfig().queries for a v2 tenant', async () => {
    const { postMutateAsync } = setup('v2', { company: 'Acme' });

    const form = getFormElement();
    await form.props.onSubmit();

    expect(postMutateAsync).toHaveBeenCalledWith(
      { entity: { company: 'Acme' } },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });

  it('posts via useVendorConfig().queries for a v3 tenant', async () => {
    const { postMutateAsync } = setup('v3', { company: 'Acme V3' });

    const form = getFormElement();
    await form.props.onSubmit();

    expect(postMutateAsync).toHaveBeenCalledWith(
      { entity: { company: 'Acme V3' } },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });
});
