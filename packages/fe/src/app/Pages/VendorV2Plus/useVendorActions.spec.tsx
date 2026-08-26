import 'reflect-metadata';
import { useVendorActions, useManyVendorActions } from './useVendorActions';

jest.mock('react-router', () => ({
  useNavigate: jest.fn(),
}));

jest.mock('../../Layout/FeedbackBanner', () => ({
  usePopBanner: jest.fn(() => jest.fn()),
}));

jest.mock('../../helpers', () => ({
  useAuthorize: jest.fn(() => true),
  useTeamEdfiTenantNavContextLoaded: jest.fn(),
  vendorAuthConfig: jest.fn((edfiTenantId, teamId, privilege) => ({
    privilege,
    subject: { edfiTenantId, teamId },
  })),
}));

jest.mock('../../helpers/mutationErrCallback', () => ({
  mutationErrCallback: jest.fn(() => ({})),
}));

jest.mock('./vendorConfig', () => ({
  useVendorConfig: jest.fn(),
}));

import { useNavigate } from 'react-router';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { useVendorConfig } from './vendorConfig';

const mockUseNavigate = useNavigate as jest.Mock;
const mockUseNavContext = useTeamEdfiTenantNavContextLoaded as jest.Mock;
const mockUseVendorConfig = useVendorConfig as jest.Mock;

const buildVendor = () => ({ id: 5, displayName: 'Acme Co' });

const setup = (version: 'v2' | 'v3') => {
  const deleteMutateAsync = jest.fn().mockResolvedValue(undefined);
  mockUseNavigate.mockReturnValue(jest.fn());
  mockUseNavContext.mockReturnValue({
    edfiTenant: { id: 3, sbEnvironmentId: 2 },
    edfiTenantId: 3,
    asId: 1,
  });
  mockUseVendorConfig.mockReturnValue({
    version,
    queries: { delete: jest.fn(() => ({ isPending: false, mutateAsync: deleteMutateAsync })) },
  });
  return { deleteMutateAsync };
};

describe('useVendorActions', () => {
  afterEach(() => jest.clearAllMocks());

  it('reads the delete mutation from useVendorConfig().queries for a v2 tenant', () => {
    const { deleteMutateAsync } = setup('v2');

    const actions = useVendorActions(buildVendor());
    actions.Delete!.onClick();

    expect(deleteMutateAsync).toHaveBeenCalledWith(
      { id: 5 },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });

  it('reads the delete mutation from useVendorConfig().queries for a v3 tenant', () => {
    const { deleteMutateAsync } = setup('v3');

    const actions = useVendorActions(buildVendor());
    actions.Delete!.onClick();

    expect(deleteMutateAsync).toHaveBeenCalledWith(
      { id: 5 },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });

  it('returns an empty object for useManyVendorActions when create is unauthorized', () => {
    setup('v2');
    jest.requireMock('../../helpers').useAuthorize.mockReturnValue(false);

    expect(useManyVendorActions()).toEqual({});
  });
});
