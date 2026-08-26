import 'reflect-metadata';
import { useEdorgsActions } from './useEdorgsActions';

jest.mock('react-router', () => ({
  useNavigate: jest.fn(),
}));

jest.mock('../../helpers', () => ({
  useTeamSbEnvironmentNavContext: jest.fn(),
  useAuthorize: jest.fn(),
  teamEdfiTenantAuthConfig: jest.fn((id, edfiTenantId, teamId, privilege) => ({
    privilege,
    subject: { id, edfiTenantId, teamId },
  })),
}));

import { useNavigate } from 'react-router';
import { useTeamSbEnvironmentNavContext, useAuthorize } from '../../helpers';

const mockUseNavigate = useNavigate as jest.Mock;
const mockUseNavContext = useTeamSbEnvironmentNavContext as jest.Mock;
const mockUseAuthorize = useAuthorize as jest.Mock;

const setupMocks = (
  version: 'v1' | 'v2' | 'v3' | undefined,
  startingBlocks: boolean,
  canPost = true
) => {
  mockUseNavigate.mockReturnValue(jest.fn());
  mockUseNavContext.mockReturnValue({
    edfiTenantId: 10,
    sbEnvironmentId: 1,
    sbEnvironment: { version, startingBlocks },
    teamId: 1,
  });
  mockUseAuthorize.mockReturnValue(canPost);
};

describe('useEdorgsActions', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns a Create action for a v2 Starting-Blocks environment', () => {
    setupMocks('v2', true);

    const result = useEdorgsActions({});

    expect(result).toHaveProperty('Create');
    expect(result.Create).toMatchObject({ text: 'Create', title: 'Create new ed-org.' });
  });

  it('returns a Create action for a v3 Starting-Blocks environment', () => {
    setupMocks('v3', true);

    const result = useEdorgsActions({});

    expect(result).toHaveProperty('Create');
  });

  it('returns an empty object for a v2 non-Starting-Blocks environment', () => {
    setupMocks('v2', false);

    const result = useEdorgsActions({});

    expect(result).toEqual({});
  });

  it('returns an empty object for a v1 Starting-Blocks environment', () => {
    setupMocks('v1', true);

    const result = useEdorgsActions({});

    expect(result).toEqual({});
  });

  it('returns an empty object when the user lacks create privilege', () => {
    setupMocks('v2', true, false);

    const result = useEdorgsActions({});

    expect(result).toEqual({});
  });
});
