import 'reflect-metadata';
import { useQuery } from '@tanstack/react-query';
import { sbEnvironmentQueries } from '../api';
import { useAuthorize } from './Authorize';
import { useIsStartingBlocksDeployment } from './useIsStartingBlocksDeployment';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
}));

jest.mock('../api', () => ({
  sbEnvironmentQueries: {
    getAll: jest.fn(() => ({ queryKey: ['sb-environments'] })),
  },
}));

jest.mock('./Authorize', () => ({
  useAuthorize: jest.fn(),
}));

const mockUseQuery = useQuery as jest.Mock;
const mockUseAuthorize = useAuthorize as jest.Mock;

describe('useIsStartingBlocksDeployment', () => {
  beforeEach(() => {
    mockUseAuthorize.mockReturnValue(true);
    mockUseQuery.mockReturnValue({ data: undefined });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns false when the deployment\'s environment has startingBlocks: false', () => {
    mockUseQuery.mockReturnValue({
      data: { 1: { id: 1, startingBlocks: false } },
    });

    expect(useIsStartingBlocksDeployment()).toBe(false);
  });

  it('returns true when the deployment\'s environment has startingBlocks: true', () => {
    mockUseQuery.mockReturnValue({
      data: { 1: { id: 1, startingBlocks: true } },
    });

    expect(useIsStartingBlocksDeployment()).toBe(true);
    expect(sbEnvironmentQueries.getAll).toHaveBeenCalledWith({});
  });

  it('defaults to false while environments are still loading', () => {
    expect(useIsStartingBlocksDeployment()).toBe(false);
  });

  it('only enables the SbEnvironment query when authorized for sb-environment:read', () => {
    useIsStartingBlocksDeployment();

    expect(mockUseAuthorize).toHaveBeenCalledWith({
      privilege: 'sb-environment:read',
      subject: { id: '__filtered__' },
    });
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true })
    );
  });

  it('disables the SbEnvironment query for a role lacking sb-environment:read, falling back to false', () => {
    mockUseAuthorize.mockReturnValue(false);

    const result = useIsStartingBlocksDeployment();

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false })
    );
    expect(result).toBe(false);
  });
});
