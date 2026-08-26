import 'reflect-metadata';

jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useMemo: (factory: () => unknown) => factory(),
}));
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { useNavToParent, useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { useClaimsetConfig } from './claimsetConfig';
import { CopyClaimsetForm } from './CopyClaimset';

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
  useNavToParent: jest.fn(() => '/parent'),
  useTeamEdfiTenantNavContextLoaded: jest.fn(),
}));

jest.mock('../../helpers/mutationErrCallback', () => ({
  mutationErrCallback: jest.fn(() => ({})),
}));

jest.mock('./claimsetConfig', () => ({
  useClaimsetConfig: Object.assign(jest.fn(), { match: jest.fn() }),
}));

const mockUseForm = useForm as jest.Mock;
const mockUseNavigate = useNavigate as jest.Mock;
const mockUseNavToParent = useNavToParent as jest.Mock;
const mockUseTeamEdfiTenantNavContextLoaded = useTeamEdfiTenantNavContextLoaded as jest.Mock;
const mockMatch = useClaimsetConfig.match as jest.Mock;

// CopyClaimsetForm dispatches via `.match()` to CopyClaimsetFormInner, so
// getting to the actual <form> requires invoking that inner component too
// (same "call as a plain function" approach used by CreateProfilePage.spec.tsx).
const getFormElement = (claimset: { id: number; name: string }) => {
  const outer = CopyClaimsetForm({ claimset }) as React.ReactElement;
  const inner = (outer.type as (props: unknown) => React.ReactElement)(outer.props);
  return inner.props.children as React.ReactElement;
};

const setup = (version: 'v2' | 'v3', formData: Record<string, unknown>) => {
  const copyMutateAsync = jest.fn();
  mockUseNavigate.mockReturnValue(jest.fn());
  mockUseNavToParent.mockReturnValue('/parent');
  mockUseTeamEdfiTenantNavContextLoaded.mockReturnValue({
    teamId: 1,
    edfiTenant: { id: 3, sbEnvironmentId: 2 },
  });
  mockUseForm.mockReturnValue({
    register: jest.fn(() => ({})),
    setError: jest.fn(),
    handleSubmit: (submit: (data: Record<string, unknown>) => Promise<void>) => () => submit(formData),
    formState: { errors: {}, isSubmitting: false },
  });
  copyMutateAsync.mockResolvedValue({ id: 42 });
  const config = {
    version,
    queries: { copy: jest.fn(() => ({ mutateAsync: copyMutateAsync })) },
    CopyDto: class CopyDtoStub {},
  };
  mockMatch.mockImplementation((handlers: Record<string, (cfg: typeof config) => unknown>) =>
    handlers[version](config)
  );
  return { copyMutateAsync };
};

describe('CopyClaimsetForm', () => {
  afterEach(() => jest.clearAllMocks());

  it('copies via useClaimsetConfig().queries for a v2 tenant', async () => {
    const { copyMutateAsync } = setup('v2', { originalId: 1, name: 'SIS Vendor (copy)' });

    const form = getFormElement({ id: 1, name: 'SIS Vendor' });
    await form.props.onSubmit();

    expect(copyMutateAsync).toHaveBeenCalledWith(
      { entity: { originalId: 1, name: 'SIS Vendor (copy)' }, pathParams: {} },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });

  it('copies via useClaimsetConfig().queries for a v3 tenant', async () => {
    const { copyMutateAsync } = setup('v3', { originalId: 1, name: 'SIS Vendor V3 (copy)' });

    const form = getFormElement({ id: 1, name: 'SIS Vendor' });
    await form.props.onSubmit();

    expect(copyMutateAsync).toHaveBeenCalledWith(
      { entity: { originalId: 1, name: 'SIS Vendor V3 (copy)' }, pathParams: {} },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });
});

// Recursively collect every string rendered anywhere in the element tree, so the
// assertion does not depend on where in the FormControl the helper text sits.
const collectText = (node: unknown, acc: string[] = []): string[] => {
  if (node === null || node === undefined || node === false) return acc;
  if (typeof node === 'string') { acc.push(node); return acc; }
  if (Array.isArray(node)) { node.forEach((n) => collectText(n, acc)); return acc; }
  if (typeof node === 'object' && 'props' in (node as { props?: unknown })) {
    return collectText((node as { props: { children?: unknown } }).props?.children, acc);
  }
  return acc;
};

describe('CopyClaimsetForm name helper text', () => {
  afterEach(() => jest.clearAllMocks());

  it('shows the no-whitespace helper text for a v3 tenant', () => {
    setup('v3', { originalId: 1, name: 'SIS Vendor (copy)' });
    const form = getFormElement({ id: 1, name: 'SIS Vendor' });
    expect(collectText(form)).toContain('Cannot contain whitespace.');
  });

  it('does not show the helper text for a v2 tenant', () => {
    setup('v2', { originalId: 1, name: 'SIS Vendor (copy)' });
    const form = getFormElement({ id: 1, name: 'SIS Vendor' });
    expect(collectText(form)).not.toContain('Cannot contain whitespace.');
  });
});
