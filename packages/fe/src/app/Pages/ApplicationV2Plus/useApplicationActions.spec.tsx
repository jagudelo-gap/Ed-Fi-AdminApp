import 'reflect-metadata';
import { useSingleApplicationActions } from './useApplicationActions';

jest.mock('react-router', () => ({
  useNavigate: jest.fn(),
  useLocation: jest.fn(),
}));

jest.mock('../../Layout/FeedbackBanner', () => ({
  usePopBanner: jest.fn(() => jest.fn()),
}));

jest.mock('../../helpers', () => ({
  useAuthorize: jest.fn(() => true),
  useNavToParent: jest.fn(() => '/parent'),
  useTeamEdfiTenantNavContext: jest.fn(),
  useTeamEdfiTenantNavContextLoaded: jest.fn(),
}));

jest.mock('../../helpers/mutationErrCallback', () => ({
  mutationErrCallback: jest.fn(() => ({})),
}));

jest.mock('../../helpers/useSearch', () => ({
  useSearchParamsObject: jest.fn(() => ({})),
}));

jest.mock('./applicationConfig', () => ({
  useApplicationConfig: jest.fn(),
  getDataStoreIds: jest.requireActual('./applicationEntity').getDataStoreIds,
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: jest.fn(),
}));

import { useLocation, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { useApplicationConfig } from './applicationConfig';

const mockUseNavigate = useNavigate as jest.Mock;
const mockUseLocation = useLocation as jest.Mock;
const mockUseNavContext = useTeamEdfiTenantNavContextLoaded as jest.Mock;
const mockUseApplicationConfig = useApplicationConfig as jest.Mock;
const mockUseQueryClient = useQueryClient as jest.Mock;

const buildApplication = () => ({
  id: 7,
  applicationName: 'Acme App',
  odsInstanceIds: [1],
  dataStoreIds: [1],
  educationOrganizationIds: [2],
});

const setup = (version: 'v2' | 'v3') => {
  const deleteMutate = jest.fn();
  mockUseNavigate.mockReturnValue(jest.fn());
  mockUseLocation.mockReturnValue({ pathname: '/applications/7' });
  mockUseQueryClient.mockReturnValue({ invalidateQueries: jest.fn() });
  mockUseNavContext.mockReturnValue({
    edfiTenantId: 3,
    asId: 1,
    edfiTenant: { id: 3, sbEnvironmentId: 2 },
  });
  mockUseApplicationConfig.mockReturnValue({
    version,
    queries: { delete: jest.fn(() => ({ isPending: false, mutate: deleteMutate })) },
  });
  return { deleteMutate };
};

describe('useSingleApplicationActions', () => {
  afterEach(() => jest.clearAllMocks());

  it('includes Manage creds for a v2 tenant', () => {
    setup('v2');
    const actions = useSingleApplicationActions({ application: buildApplication() as never });
    expect(actions.Manage).toBeDefined();
  });

  it('omits Manage creds for a v3 tenant', () => {
    setup('v3');
    const actions = useSingleApplicationActions({ application: buildApplication() as never });
    expect(actions.Manage).toBeUndefined();
  });

  it('deletes via useApplicationConfig().queries for a v3 tenant', () => {
    const { deleteMutate } = setup('v3');
    const actions = useSingleApplicationActions({ application: buildApplication() as never });
    actions.Delete!.onClick();
    expect(deleteMutate).toHaveBeenCalledWith(
      { id: 7 },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });
});
