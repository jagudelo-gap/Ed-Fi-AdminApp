import 'reflect-metadata';
import { EditVendor } from './EditVendor';

// EditVendor is invoked directly as a plain function below (not rendered via a test
// renderer), so React's real hook dispatcher is never installed. All other hooks the
// component calls are mocked modules (not real React hooks), but useMemo is imported
// directly from 'react' and would crash with "Cannot read properties of null (reading
// 'useMemo')" outside of an actual render. Shim it to just invoke the factory
// immediately; this does not affect any test assertions. (Same accepted pattern as
// CreateVendorPage.spec.tsx from Task 6.)
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useMemo: (factory: () => unknown) => factory(),
}));
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { useVendorConfig } from './vendorConfig';

jest.mock('@edanalytics/common-ui', () => ({
  Icons: { InfoCircle: () => null },
}));

jest.mock('react-router', () => ({
  useNavigate: jest.fn(),
  useParams: jest.fn(),
}));

jest.mock('react-hook-form', () => ({
  useForm: jest.fn(),
}));

jest.mock('@hookform/resolvers/class-validator', () => ({
  classValidatorResolver: jest.fn((Dto) => Dto),
}));

jest.mock('../../Layout/FeedbackBanner', () => ({
  usePopBanner: jest.fn(() => jest.fn()),
}));

jest.mock('../../helpers', () => ({
  useTeamEdfiTenantNavContextLoaded: jest.fn(),
}));

jest.mock('../../helpers/mutationErrCallback', () => ({
  mutationErrCallback: jest.fn(() => ({})),
}));

jest.mock('./vendorConfig', () => ({
  useVendorConfig: Object.assign(jest.fn(), { match: jest.fn() }),
}));

const mockUseNavigate = useNavigate as jest.Mock;
const mockUseParams = useParams as jest.Mock;
const mockUseForm = useForm as jest.Mock;
const mockUseTeamEdfiTenantNavContextLoaded = useTeamEdfiTenantNavContextLoaded as jest.Mock;
const mockMatch = useVendorConfig.match as jest.Mock;

const vendor = { id: 5, company: 'Acme', namespacePrefixes: '', contactName: '', contactEmailAddress: '' };

const setup = (version: 'v2' | 'v3') => {
  const putMutateAsync = jest.fn().mockResolvedValue(vendor);
  mockUseNavigate.mockReturnValue(jest.fn());
  mockUseParams.mockReturnValue({ vendorId: '5' });
  mockUseTeamEdfiTenantNavContextLoaded.mockReturnValue({
    teamId: 1,
    edfiTenant: { id: 3, sbEnvironmentId: 2 },
  });
  mockUseForm.mockReturnValue({
    register: jest.fn(() => ({})),
    setError: jest.fn(),
    handleSubmit: (submit: (data: Record<string, unknown>) => Promise<void>) => () => submit({ company: 'Updated' }),
    formState: { errors: {}, isSubmitting: false },
  });
  const config = {
    version,
    queries: { put: jest.fn(() => ({ mutateAsync: putMutateAsync })) },
    PutDto: class PutDtoStub {
      constructor() {
        Object.assign(this, {});
      }
    },
  };
  mockMatch.mockImplementation((handlers: Record<string, (cfg: typeof config) => unknown>) =>
    handlers[version](config)
  );
  return { putMutateAsync };
};

// EditVendor now dispatches via `.match()` to a per-version `EditVendorForm`,
// so getting to the actual <form> requires invoking that inner component too
// (same "call as a plain function" approach as EditVendor itself, one level
// deeper).
const getFormElement = (vendorProp: typeof vendor) => {
  const outer = EditVendor({ vendor: vendorProp }) as React.ReactElement;
  return (outer.type as (props: unknown) => React.ReactElement)(outer.props);
};

describe('EditVendor', () => {
  afterEach(() => jest.clearAllMocks());

  it('puts via useVendorConfig().queries for a v2 tenant', async () => {
    const { putMutateAsync } = setup('v2');

    const form = getFormElement(vendor);
    await form.props.onSubmit();

    expect(putMutateAsync).toHaveBeenCalledWith(
      { entity: { company: 'Updated' } },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });

  it('puts via useVendorConfig().queries for a v3 tenant', async () => {
    const { putMutateAsync } = setup('v3');

    const form = getFormElement(vendor);
    await form.props.onSubmit();

    expect(putMutateAsync).toHaveBeenCalledWith(
      { entity: { company: 'Updated' } },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });
});
