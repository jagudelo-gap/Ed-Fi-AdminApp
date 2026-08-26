import 'reflect-metadata';

jest.mock('../../helpers', () => ({
  useTeamEdfiTenantNavContextLoaded: jest.fn(),
}));

jest.mock('../../../config/config', () => ({
  config: { showRequestCertification: false, apiUrl: '/api' },
}));

jest.mock('kebab-case', () => (str: string) => str);

import { CopyClaimsetDtoV2, CopyClaimsetDtoV3 } from '@edanalytics/models';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { claimsetQueriesV2, claimsetQueriesV3 } from '../../api';
import { useClaimsetConfig } from './claimsetConfig';

const mockUseNavContext = useTeamEdfiTenantNavContextLoaded as jest.Mock;

const setVersion = (version: 'v2' | 'v3') => {
  mockUseNavContext.mockReturnValue({ edfiTenant: { sbEnvironment: { version } } });
};

// This spec deliberately does NOT mock './claimsetConfig' — every other
// Claimset spec does, which means the real useClaimsetConfig() -> version ->
// claimsetQueriesV2/V3 resolution built by createVersionedResource is never
// exercised anywhere else. createVersionedResource does not catch a
// mis-keyed branch at compile time, so this test exists to catch that class
// of bug at runtime.
describe('useClaimsetConfig', () => {
  afterEach(() => jest.clearAllMocks());

  it('resolves to the V2 queries and DTOs for a v2 tenant', () => {
    setVersion('v2');

    const config = useClaimsetConfig();

    expect(config.queries).toBe(claimsetQueriesV2);
    expect(config.CopyDto).toBe(CopyClaimsetDtoV2);
  });

  it('resolves to the V3 queries and DTOs for a v3 tenant', () => {
    setVersion('v3');

    const config = useClaimsetConfig();

    expect(config.queries).toBe(claimsetQueriesV3);
    expect(config.CopyDto).toBe(CopyClaimsetDtoV3);
  });
});
