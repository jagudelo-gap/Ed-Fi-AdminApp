import 'reflect-metadata';
import { ApplicationPageTitle } from './ApplicationPage';

jest.mock('@edanalytics/common-ui', () => ({
  OneTimeShareCredentials: () => null,
  PageActions: () => null,
  PageContentCard: ({ children }: { children: React.ReactNode }) => children,
  PageTemplate: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('lodash/omit', () => (obj: object) => obj);
jest.mock('react-error-boundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('react-router', () => ({ useParams: jest.fn() }));
jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));
jest.mock('../../helpers', () => ({ useTeamEdfiTenantNavContextLoaded: jest.fn() }));
jest.mock('../../helpers/useSearch', () => ({ useSearchParamsObject: jest.fn(() => ({ edit: false })) }));
jest.mock('./EditApplication', () => ({ EditApplication: () => null }));
jest.mock('./ViewApplication', () => ({ ViewApplication: () => null }));
jest.mock('./useApplicationActions', () => ({ useSingleApplicationActions: jest.fn(() => ({})) }));
jest.mock('../../api-v2', () => ({ useGetOneApplication: jest.fn() }));
jest.mock('./applicationConfig', () => ({
  useApplicationConfig: jest.fn(),
  getDataStoreIds: jest.requireActual('./applicationEntity').getDataStoreIds,
}));
jest.mock('../ClaimsetV2Plus/claimsetConfig', () => ({
  useClaimsetConfig: jest.fn(() => ({ queries: { getAll: jest.fn(() => ({ queryKey: ['claimsets'] })) } })),
}));

import { render } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { useGetOneApplication } from '../../api-v2';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { useApplicationConfig } from './applicationConfig';

const mockUseParams = useParams as jest.Mock;
const mockUseQuery = useQuery as jest.Mock;
const mockUseNavContext = useTeamEdfiTenantNavContextLoaded as jest.Mock;
const mockUseGetOneApplication = useGetOneApplication as jest.Mock;
const mockUseApplicationConfig = useApplicationConfig as jest.Mock;

const setup = (version: 'v2' | 'v3') => {
  mockUseParams.mockReturnValue({ applicationId: '1' });
  mockUseNavContext.mockReturnValue({
    edfiTenantId: 3,
    asId: 1,
    edfiTenant: { id: 3, sbEnvironmentId: 2 },
  });
  mockUseApplicationConfig.mockReturnValue({
    version,
    queries: { getOne: jest.fn(() => ({ queryKey: ['v3-application'] })) },
  });
  mockUseGetOneApplication.mockReturnValue({ data: undefined });
  mockUseQuery.mockReturnValue({ data: undefined });
};

describe('ApplicationPageTitle (useApplicationDetail gating)', () => {
  afterEach(() => jest.clearAllMocks());

  it('enables the V2 hook and disables the V3 builder query for a v2 tenant', () => {
    setup('v2');
    render(<ApplicationPageTitle />);
    expect(mockUseGetOneApplication).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
    expect(mockUseQuery).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it('disables the V2 hook and enables the V3 builder query for a v3 tenant', () => {
    setup('v3');
    render(<ApplicationPageTitle />);
    expect(mockUseGetOneApplication).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
    expect(mockUseQuery).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
  });
});
