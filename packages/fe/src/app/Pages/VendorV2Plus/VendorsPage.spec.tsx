import 'reflect-metadata';
import { VendorsPageContent } from './VendorsPage';
import { useQuery } from '@tanstack/react-query';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { useVendorConfig } from './vendorConfig';

jest.mock('react-router', () => ({
  useNavigate: jest.fn(),
}));

jest.mock('@edanalytics/common-ui', () => ({
  CappedLinesText: ({ children }: { children: React.ReactNode }) => children,
  PageActions: () => null,
  PageTemplate: ({ children }: { children: React.ReactNode }) => children,
  SbaaTableAllInOne: (props: { data: unknown[] }) => JSON.stringify(props.data),
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
}));

jest.mock('../../helpers', () => ({
  useTeamEdfiTenantNavContextLoaded: jest.fn(),
}));

jest.mock('./vendorConfig', () => ({
  useVendorConfig: jest.fn(),
}));

jest.mock('./NameCell', () => ({ NameCell: () => null }));

const mockUseQuery = useQuery as jest.Mock;
const mockUseTeamEdfiTenantNavContextLoaded = useTeamEdfiTenantNavContextLoaded as jest.Mock;
const mockUseVendorConfig = useVendorConfig as jest.Mock;

const setup = (version: 'v2' | 'v3') => {
  const getAll = jest.fn(() => ({ queryKey: ['vendors'] }));
  mockUseTeamEdfiTenantNavContextLoaded.mockReturnValue({
    edfiTenant: { id: 3 },
    asId: 1,
  });
  mockUseVendorConfig.mockReturnValue({ version, queries: { getAll } });
  mockUseQuery.mockReturnValue({ data: { 5: { id: 5, company: 'Acme' } } });
  return { getAll };
};

describe('VendorsPageContent', () => {
  afterEach(() => jest.clearAllMocks());

  it('calls useVendorConfig().queries.getAll for a v2 tenant', () => {
    const { getAll } = setup('v2');

    VendorsPageContent();

    expect(getAll).toHaveBeenCalledWith({ teamId: 1, edfiTenant: { id: 3 } });
  });

  it('calls useVendorConfig().queries.getAll for a v3 tenant', () => {
    const { getAll } = setup('v3');

    VendorsPageContent();

    expect(getAll).toHaveBeenCalledWith({ teamId: 1, edfiTenant: { id: 3 } });
  });
});
