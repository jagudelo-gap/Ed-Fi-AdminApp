import 'reflect-metadata';
import { AllApplicationsTable } from './ApplicationsPage';

jest.mock('@edanalytics/common-ui', () => ({
  CappedLinesText: ({ children }: { children: React.ReactNode }) => children,
  PageActions: () => null,
  PageTemplate: ({ children }: { children: React.ReactNode }) => children,
  SbaaTableAllInOne: ({ data }: { data: unknown[] }) => (
    <div data-testid="row-count">{data.length}</div>
  ),
}));

jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn(() => ({ data: {} })) }));

jest.mock('../../api', () => ({
  edorgQueries: { getAll: jest.fn() },
  odsQueries: { getAll: jest.fn() },
  profileQueriesV2: { getAll: jest.fn() },
  vendorQueriesV2: { getAll: jest.fn() },
}));

jest.mock('../../helpers', () => ({ useTeamEdfiTenantNavContextLoaded: jest.fn() }));
jest.mock('../../helpers/getRelationDisplayName', () => ({ getRelationDisplayName: jest.fn(() => '-') }));
jest.mock('../../routes/claimset.routes', () => ({ ClaimsetLinkV2: () => null }));
jest.mock('../../routes/edorg.routes', () => ({ EdorgLink: () => null }));
jest.mock('../../routes/ods.routes', () => ({ OdsLink: () => null }));
jest.mock('../../routes/profile.routes', () => ({ ProfileLink: () => null }));
jest.mock('../../routes/vendor.routes', () => ({ VendorLinkV2: () => null }));
jest.mock('./NameCell', () => ({ NameCell: () => null }));
jest.mock('./useApplicationActions', () => ({ useMultiApplicationActions: jest.fn(() => ({})) }));
jest.mock('../../api-v2', () => ({ useGetManyApplications: jest.fn(() => ({ data: [{ id: 1 }] })) }));
jest.mock('./applicationConfig', () => ({
  useApplicationConfig: jest.fn(),
  getDataStoreIds: jest.requireActual('./applicationEntity').getDataStoreIds,
}));
jest.mock('../ClaimsetV2Plus/claimsetConfig', () => ({ useClaimsetConfig: jest.fn() }));
jest.mock('../Ods/useOdsTerminology', () => ({
  useOdsTerminology: jest.fn(() => ({ singular: 'ODS', plural: 'Ods', listTitle: 'ODS', createTitle: 'Create ODS' })),
}));

import { render, screen } from '@testing-library/react';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { useGetManyApplications } from '../../api-v2';
import { useApplicationConfig } from './applicationConfig';
import { useClaimsetConfig } from '../ClaimsetV2Plus/claimsetConfig';

const mockUseNavContext = useTeamEdfiTenantNavContextLoaded as jest.Mock;
const mockUseGetManyApplications = useGetManyApplications as jest.Mock;
const mockUseApplicationConfig = useApplicationConfig as jest.Mock;
const mockUseClaimsetConfig = useClaimsetConfig as jest.Mock;

describe('AllApplicationsTable', () => {
  beforeEach(() => {
    mockUseClaimsetConfig.mockReturnValue({ queries: { getAll: jest.fn() } });
  });
  afterEach(() => jest.clearAllMocks());

  it('renders v2 applications from useGetManyApplications', () => {
    mockUseNavContext.mockReturnValue({ asId: 1, edfiTenantId: 3, edfiTenant: { id: 3 } });
    mockUseApplicationConfig.mockReturnValue({ version: 'v2', queries: { getAll: jest.fn() } });
    mockUseGetManyApplications.mockReturnValue({ data: [{ id: 1 }, { id: 2 }] });

    render(<AllApplicationsTable />);

    expect(screen.getByTestId('row-count').textContent).toBe('2');
  });

  it('renders v3 applications from applicationQueriesV3 via config', () => {
    mockUseNavContext.mockReturnValue({ asId: 1, edfiTenantId: 3, edfiTenant: { id: 3 } });
    const getAll = jest.fn(() => ({ queryKey: ['v3-apps'] }));
    mockUseApplicationConfig.mockReturnValue({ version: 'v3', queries: { getAll } });
    // useQuery is mocked globally above to return { data: {} }; override just for this test's
    // application-list call by checking getAll was invoked with the v3 branch's queries.
    render(<AllApplicationsTable />);

    expect(getAll).toHaveBeenCalled();
  });

  it('disables the V2 useGetManyApplications hook when the tenant is v3', () => {
    mockUseNavContext.mockReturnValue({ asId: 1, edfiTenantId: 3, edfiTenant: { id: 3 } });
    const getAll = jest.fn(() => ({ queryKey: ['v3-apps'] }));
    mockUseApplicationConfig.mockReturnValue({ version: 'v3', queries: { getAll } });

    render(<AllApplicationsTable />);

    expect(mockUseGetManyApplications).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false })
    );
  });

  it('enables the V2 useGetManyApplications hook when the tenant is v2', () => {
    mockUseNavContext.mockReturnValue({ asId: 1, edfiTenantId: 3, edfiTenant: { id: 3 } });
    mockUseApplicationConfig.mockReturnValue({ version: 'v2', queries: { getAll: jest.fn() } });
    mockUseGetManyApplications.mockReturnValue({ data: [{ id: 1 }, { id: 2 }] });

    render(<AllApplicationsTable />);

    expect(mockUseGetManyApplications).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true })
    );
  });

  it('looks up claimsets via useClaimsetConfig().queries for a v3 tenant, not a hardcoded v2 query', () => {
    mockUseNavContext.mockReturnValue({ asId: 1, edfiTenantId: 3, edfiTenant: { id: 3 } });
    mockUseApplicationConfig.mockReturnValue({ version: 'v3', queries: { getAll: jest.fn() } });
    const claimsetGetAll = jest.fn(() => ({ queryKey: ['v3-claimsets'] }));
    mockUseClaimsetConfig.mockReturnValue({ queries: { getAll: claimsetGetAll } });

    render(<AllApplicationsTable />);

    expect(claimsetGetAll).toHaveBeenCalled();
  });
});
