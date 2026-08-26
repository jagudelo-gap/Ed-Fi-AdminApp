import 'reflect-metadata';
import { useProfileActions, useManyProfileActions } from './useProfileActions';

jest.mock('react-router', () => ({
  useNavigate: jest.fn(),
}));

jest.mock('../../Layout/FeedbackBanner', () => ({
  usePopBanner: jest.fn(() => jest.fn()),
}));

jest.mock('../../helpers', () => ({
  useAuthorize: jest.fn(() => true),
  useTeamEdfiTenantNavContextLoaded: jest.fn(),
  useNavToParent: jest.fn(() => '/parent'),
  profileAuthConfig: jest.fn((edfiTenantId, teamId, privilege) => ({
    privilege,
    subject: { edfiTenantId, teamId },
  })),
}));

jest.mock('../../helpers/mutationErrCallback', () => ({
  mutationErrCallback: jest.fn(() => ({})),
}));

jest.mock('./profileConfig', () => ({
  useProfileConfig: jest.fn(),
}));

import { useNavigate } from 'react-router';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { useProfileConfig } from './profileConfig';

const mockUseNavigate = useNavigate as jest.Mock;
const mockUseNavContext = useTeamEdfiTenantNavContextLoaded as jest.Mock;
const mockUseProfileConfig = useProfileConfig as jest.Mock;

const buildProfile = () => ({ id: 5, name: 'Test Profile' });

const setup = (version: 'v2' | 'v3') => {
  const deleteMutateAsync = jest.fn().mockResolvedValue(undefined);
  mockUseNavigate.mockReturnValue(jest.fn());
  mockUseNavContext.mockReturnValue({
    edfiTenant: { id: 3, sbEnvironmentId: 2 },
    edfiTenantId: 3,
    asId: 1,
  });
  mockUseProfileConfig.mockReturnValue({
    version,
    queries: { delete: jest.fn(() => ({ isPending: false, mutateAsync: deleteMutateAsync })) },
  });
  return { deleteMutateAsync };
};

describe('useProfileActions', () => {
  afterEach(() => jest.clearAllMocks());

  it('reads the delete mutation from useProfileConfig().queries for a v2 tenant', () => {
    const { deleteMutateAsync } = setup('v2');

    const actions = useProfileActions(buildProfile());
    actions.Delete!.onClick();

    expect(deleteMutateAsync).toHaveBeenCalledWith(
      { id: 5 },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });

  it('reads the delete mutation from useProfileConfig().queries for a v3 tenant', () => {
    const { deleteMutateAsync } = setup('v3');

    const actions = useProfileActions(buildProfile());
    actions.Delete!.onClick();

    expect(deleteMutateAsync).toHaveBeenCalledWith(
      { id: 5 },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });

  it('returns an empty object for useManyProfileActions when create is unauthorized', () => {
    setup('v2');
    jest.requireMock('../../helpers').useAuthorize.mockReturnValue(false);

    expect(useManyProfileActions()).toEqual({});
  });
});
