import 'reflect-metadata';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { ResourceClaimsTableV2, ResourceClaimsTableV3 } from '@edanalytics/common-ui';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { useClaimsetConfig } from './claimsetConfig';
import { ClaimsetPageContent } from './ClaimsetPage';

jest.mock('react-router', () => ({
  useParams: jest.fn(),
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
}));

jest.mock('../../helpers', () => ({
  useTeamEdfiTenantNavContextLoaded: jest.fn(),
}));

jest.mock('../../helpers/useSearch', () => ({
  useSearchParamsObject: jest.fn(() => ({})),
}));

jest.mock('./claimsetConfig', () => ({
  useClaimsetConfig: Object.assign(jest.fn(), { match: jest.fn() }),
}));

// ClaimsetPage.tsx also exports ClaimsetPageActions, which pulls in
// useClaimsetActions.tsx. That module reads its queries from
// useClaimsetConfig() (Export works the same way for both versions now), but
// it also imports `API_URL` directly from '../../api', and '../../api'
// transitively reaches config.ts's `import.meta.env`, which Jest's Babel
// transform can't parse. Mocking '../../api' here avoids loading that chain;
// ClaimsetPageContent (the only thing under test) never touches it.
jest.mock('../../api', () => ({
  API_URL: '',
}));

jest.mock('@edanalytics/common-ui', () => ({
  ResourceClaimsTableV2: () => null,
  ResourceClaimsTableV3: () => null,
}));

const mockUseParams = useParams as jest.Mock;
const mockUseQuery = useQuery as jest.Mock;
const mockUseNavContext = useTeamEdfiTenantNavContextLoaded as jest.Mock;
const mockMatch = useClaimsetConfig.match as jest.Mock;

const setup = (version: 'v2' | 'v3', claimset: object) => {
  mockUseParams.mockReturnValue({ claimsetId: '1' });
  mockUseNavContext.mockReturnValue({ teamId: 1, edfiTenant: { id: 3, sbEnvironmentId: 2 } });
  mockUseQuery.mockReturnValue({ data: claimset });
  const config = { version, queries: { getOne: jest.fn(() => ({})) } };
  mockMatch.mockImplementation((handlers: Record<string, (cfg: typeof config) => unknown>) =>
    handlers[version](config)
  );
};

describe('ClaimsetPageContent', () => {
  afterEach(() => jest.clearAllMocks());

  it('renders ViewClaimset with ResourceClaimsTableV2 for a v2 tenant', () => {
    const claimset = { id: 1, displayName: 'SIS Vendor' };
    setup('v2', claimset);

    const element = ClaimsetPageContent() as React.ReactElement;
    const viewClaimsetElement = element.props.children as React.ReactElement;

    expect(viewClaimsetElement.props.claimset).toBe(claimset);
    expect(viewClaimsetElement.props.ResourceClaimsTable).toBe(ResourceClaimsTableV2);
  });

  it('renders ViewClaimset with ResourceClaimsTableV3 for a v3 tenant', () => {
    const claimset = { id: 1, displayName: 'SIS Vendor' };
    setup('v3', claimset);

    const element = ClaimsetPageContent() as React.ReactElement;
    const viewClaimsetElement = element.props.children as React.ReactElement;

    expect(viewClaimsetElement.props.claimset).toBe(claimset);
    expect(viewClaimsetElement.props.ResourceClaimsTable).toBe(ResourceClaimsTableV3);
  });
});
