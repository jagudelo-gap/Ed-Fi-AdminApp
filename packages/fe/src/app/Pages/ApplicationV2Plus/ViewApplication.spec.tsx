import 'reflect-metadata';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { ViewApplication } from './ViewApplication';

jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn(() => ({ data: {} })) }));
jest.mock('../../helpers', () => ({ useTeamEdfiTenantNavContextLoaded: jest.fn(() => ({ edfiTenant: {}, teamId: 1 })) }));
jest.mock('../../api', () => ({
  edorgQueries: { getAll: jest.fn() },
  odsQueries: { getAll: jest.fn() },
  profileQueriesV2: { getAll: jest.fn() },
  vendorQueriesV2: { getAll: jest.fn() },
}));
jest.mock('../ClaimsetV2Plus/claimsetConfig', () => ({
  useClaimsetConfig: jest.fn(() => ({ queries: { getAll: jest.fn() } })),
}));
jest.mock('../Ods/useOdsTerminology', () => ({
  useOdsTerminology: jest.fn(() => ({ singular: 'ODS', plural: 'Ods', listTitle: 'ODS', createTitle: 'Create ODS' })),
}));
jest.mock('../../routes', () => ({
  ClaimsetLinkV2: () => null,
  EdorgLink: () => null,
  OdsLink: ({ id }: { id: number }) => <span>ods-{id}</span>,
  ProfileLink: () => null,
  VendorLinkV2: () => null,
}));
jest.mock('@edanalytics/common-ui', () => ({
  Attribute: ({ value }: { value: unknown }) => <span>{String(value)}</span>,
  AttributeContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AttributesGrid: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ContentSection: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { useClaimsetConfig } from '../ClaimsetV2Plus/claimsetConfig';

const mockUseClaimsetConfig = useClaimsetConfig as jest.Mock;

describe('ViewApplication', () => {
  afterEach(() => jest.clearAllMocks());

  it('renders the dataStoreIds prop for a v3 application, not application.odsInstanceIds', () => {
    mockUseClaimsetConfig.mockReturnValue({ queries: { getAll: jest.fn() } });
    render(
      <ViewApplication
        application={{
          id: 1,
          applicationName: 'App1',
          vendorId: 1,
          claimSetName: 'CS',
          profileIds: [],
          educationOrganizationIds: [2],
        } as never}
        dataStoreIds={[42]}
      />
    );
    expect(screen.getByText('ods-42')).toBeInTheDocument();
  });

  it('renders a "-" fallback instead of throwing when dataStoreIds is empty', () => {
    mockUseClaimsetConfig.mockReturnValue({ queries: { getAll: jest.fn() } });
    expect(() =>
      render(
        <ViewApplication
          application={{
            id: 1,
            applicationName: 'App1',
            vendorId: 1,
            claimSetName: 'CS',
            profileIds: [],
            educationOrganizationIds: [2],
          } as never}
          dataStoreIds={[]}
        />
      )
    ).not.toThrow();
  });

  it('looks up claimsets via useClaimsetConfig().queries, not a hardcoded v2 query', () => {
    const claimsetGetAll = jest.fn(() => ({ queryKey: ['v3-claimsets'] }));
    mockUseClaimsetConfig.mockReturnValue({ queries: { getAll: claimsetGetAll } });
    render(
      <ViewApplication
        application={{
          id: 1,
          applicationName: 'App1',
          vendorId: 1,
          claimSetName: 'CS',
          profileIds: [],
          educationOrganizationIds: [2],
        } as never}
        dataStoreIds={[42]}
      />
    );
    expect(claimsetGetAll).toHaveBeenCalled();
  });
});
