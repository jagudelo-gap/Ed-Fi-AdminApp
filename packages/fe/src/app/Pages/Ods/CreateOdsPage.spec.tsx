import 'reflect-metadata';
import { CreateOds } from './CreateOdsPage';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { odsQueries, instancesV2 } from '../../api';

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

jest.mock('../../Layout/FeedbackBanner', () => ({
  usePopBanner: jest.fn(() => jest.fn()),
}));

jest.mock('../../helpers', () => ({
  SelectOdsTemplate: () => null,
  useNavToParent: jest.fn(() => '/parent'),
  useTeamEdfiTenantNavContextLoaded: jest.fn(),
}));

jest.mock('../../helpers/mutationErrCallback', () => ({
  mutationErrCallback: jest.fn(() => ({})),
}));

jest.mock('../../api', () => ({
  odsQueries: { post: jest.fn(), getAll: jest.fn() },
  instancesV2: { post: jest.fn() },
}));

const mockUseForm = useForm as jest.Mock;
const mockUseNavigate = useNavigate as jest.Mock;
const mockUseQueryClient = useQueryClient as jest.Mock;
const mockUseTeamEdfiTenantNavContextLoaded = useTeamEdfiTenantNavContextLoaded as jest.Mock;
const mockOdsPost = odsQueries.post as jest.Mock;
const mockOdsGetAll = odsQueries.getAll as jest.Mock;
const mockInstancesPost = instancesV2.post as jest.Mock;

const navSpy = jest.fn();
const invalidateQueriesSpy = jest.fn();
const odsMutateAsync = jest.fn();
const instancesMutateAsync = jest.fn();
const getFormElement = () => {
  const result = CreateOds() as React.ReactElement;
  return result.type === 'form' ? result : (result.props.children as React.ReactElement);
};

const setup = (startingBlocks: boolean, formData: Record<string, unknown>) => {
  mockUseNavigate.mockReturnValue(navSpy);
  mockUseQueryClient.mockReturnValue({ invalidateQueries: invalidateQueriesSpy });
  mockUseTeamEdfiTenantNavContextLoaded.mockReturnValue({
    asId: 1,
    sbEnvironmentId: 2,
    edfiTenantId: 3,
    edfiTenant: { id: 3 },
    sbEnvironment: { startingBlocks },
  });

  mockUseForm.mockReturnValue({
    register: jest.fn(() => ({})),
    control: {},
    handleSubmit: (submit: (data: Record<string, unknown>) => Promise<void>) => () => submit(formData),
    setError: jest.fn(),
    formState: { errors: {}, isSubmitting: false },
  });

  odsMutateAsync.mockImplementation(
    (_args: unknown, callbacks: { onSuccess?: (result: { id: number }) => void }) => {
      callbacks.onSuccess?.({ id: 101 });
      return Promise.resolve({ id: 101 });
    }
  );
  instancesMutateAsync.mockImplementation(
    (_args: unknown, callbacks: { onSuccess?: (result: { id: number }) => void }) => {
      callbacks.onSuccess?.({ id: 202 });
      return Promise.resolve({ id: 202 });
    }
  );
  mockOdsPost.mockReturnValue({ mutateAsync: odsMutateAsync });
  mockOdsGetAll.mockReturnValue({
    queryKey: ['edfi-tenants', '3', 'odss', 'list', 'teams', '1'],
  });
  mockInstancesPost.mockReturnValue({ mutateAsync: instancesMutateAsync });
};

describe('CreateOds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invalidateQueriesSpy.mockClear();
  });

  it('uses instances mutation with databaseTemplate for non-startingBlocks', async () => {
    setup(false, { name: 'ODS One', databaseTemplate: 'Minimal' });

    const form = getFormElement();
    await form.props.onSubmit();

    expect(instancesMutateAsync).toHaveBeenCalledWith(
      { entity: { name: 'ODS One', databaseTemplate: 'Minimal' } },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
    expect(odsMutateAsync).not.toHaveBeenCalled();
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['edfi-tenants', '3', 'odss', 'list', 'teams', '1'],
    });
    expect(navSpy).toHaveBeenCalledWith('/parent');
  });

  it('uses ods mutation for startingBlocks', async () => {
    setup(true, { name: 'ODS One', templateName: 'GrandBend' });

    const form = getFormElement();
    await form.props.onSubmit();

    expect(odsMutateAsync).toHaveBeenCalledWith(
      { entity: { name: 'ODS One', templateName: 'GrandBend' } },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
    expect(instancesMutateAsync).not.toHaveBeenCalled();
    expect(navSpy).toHaveBeenCalledWith('/as/1/sb-environments/2/edfi-tenants/3/odss/101');
  });

  it('titles the page "Create new Data Store" for a v3 environment', () => {
    setup(false, { name: 'Instance One', databaseTemplate: 'Minimal' });
    mockUseTeamEdfiTenantNavContextLoaded.mockReturnValue({
      asId: 1,
      sbEnvironmentId: 2,
      edfiTenantId: 3,
      edfiTenant: { id: 3 },
      sbEnvironment: { startingBlocks: false, version: 'v3' },
    });

    const result = CreateOds() as React.ReactElement<{ title: string }>;

    expect(result.props.title).toBe('Create new Data Store');
  });
});
