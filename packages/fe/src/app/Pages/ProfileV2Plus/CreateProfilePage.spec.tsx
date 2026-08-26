import 'reflect-metadata';
import { CreateProfile } from './CreateProfilePage';

// CreateProfile is invoked directly as a plain function below (not rendered via
// a test renderer), so React's real hook dispatcher is never installed. All other
// hooks the component calls are mocked modules (not real React hooks), but useMemo
// and useState are imported directly from 'react' and would crash with "Cannot read
// properties of null" outside of an actual render. Shim both; this does not affect
// any test assertions. (Same accepted pattern as CreateVendorPage.spec.tsx.)
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useMemo: (factory: () => unknown) => factory(),
  useState: (initial: unknown) => [initial, jest.fn()],
}));
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useNavToParent, useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { useProfileConfig } from './profileConfig';

jest.mock('@edanalytics/common-ui', () => ({
  PageTemplate: ({ children }: { children: React.ReactNode }) => children,
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

jest.mock('./profileConfig', () => ({
  useProfileConfig: Object.assign(jest.fn(), { match: jest.fn() }),
}));

const mockUseForm = useForm as jest.Mock;
const mockUseNavigate = useNavigate as jest.Mock;
const mockUseQueryClient = useQueryClient as jest.Mock;
const mockUseNavToParent = useNavToParent as jest.Mock;
const mockUseTeamEdfiTenantNavContextLoaded = useTeamEdfiTenantNavContextLoaded as jest.Mock;
const mockMatch = useProfileConfig.match as jest.Mock;

// CreateProfile dispatches via `.match()` to a per-version `CreateProfileForm`,
// so getting to the actual <form> requires invoking that inner component too
// (same "call as a plain function" approach as CreateProfile itself, one level
// deeper).
const getFormElement = () => {
  const outer = CreateProfile() as React.ReactElement;
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
  });
  mockUseForm.mockReturnValue({
    register: jest.fn(() => ({})),
    handleSubmit: (submit: (data: Record<string, unknown>) => Promise<void>) => () => submit(formData),
    setError: jest.fn(),
    setValue: jest.fn(),
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

describe('CreateProfile', () => {
  afterEach(() => jest.clearAllMocks());

  it('posts via useProfileConfig().queries for a v2 tenant', async () => {
    const { postMutateAsync } = setup('v2', { name: 'Test Profile', definition: '<Profile/>' });

    const form = getFormElement();
    await form.props.onSubmit();

    expect(postMutateAsync).toHaveBeenCalledWith(
      { entity: { name: 'Test Profile', definition: '<Profile/>' } },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });

  it('posts via useProfileConfig().queries for a v3 tenant', async () => {
    const { postMutateAsync } = setup('v3', { name: 'Test Profile V3', definition: '<Profile/>' });

    const form = getFormElement();
    await form.props.onSubmit();

    expect(postMutateAsync).toHaveBeenCalledWith(
      { entity: { name: 'Test Profile V3', definition: '<Profile/>' } },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });
});
