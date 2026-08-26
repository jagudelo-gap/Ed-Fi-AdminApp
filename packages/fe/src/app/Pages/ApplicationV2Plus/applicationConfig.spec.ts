import 'reflect-metadata';

jest.mock('../../helpers', () => ({
  useTeamEdfiTenantNavContextLoaded: jest.fn(),
}));

// Importing the real './applicationConfig' below transitively pulls in the
// real '../../api' barrel (that's the whole point of this spec — see comment
// below), which in turn loads api/methods.ts -> config/config.ts, whose
// `import.meta.env` Jest cannot parse. Mock just the config module (not
// '../../api' itself) to isolate that unrelated module-load-time failure
// without faking the queries this test needs to be real.
jest.mock('../../../config/config', () => ({
  config: { showRequestCertification: false, apiUrl: '/api' },
}));

// Same rationale as the config/config mock above: the real '../../api'
// barrel also re-exports queries.ts (unrelated to Application), which
// imports the ESM-only 'kebab-case' package that Jest's transform can't
// parse. Stub it with an identity function so the real module graph can load.
jest.mock('kebab-case', () => (str: string) => str);

import {
  PostApplicationFormDtoV2,
  PostApplicationFormDtoV3,
  PutApplicationFormDtoV2,
  PutApplicationFormDtoV3,
} from '@edanalytics/models';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { applicationQueriesV2, applicationQueriesV3 } from '../../api';
import { useApplicationConfig } from './applicationConfig';

const mockUseNavContext = useTeamEdfiTenantNavContextLoaded as jest.Mock;

const setVersion = (version: 'v2' | 'v3') => {
  mockUseNavContext.mockReturnValue({ edfiTenant: { sbEnvironment: { version } } });
};

// This spec deliberately does NOT mock './applicationConfig' — every other
// Application spec does, which means the real useApplicationConfig() ->
// version -> applicationQueriesV2/V3 resolution built by
// createVersionedResource is never exercised anywhere else.
// createVersionedResource does not catch a mis-keyed branch at compile time
// (e.g. `{ v2: { version: 'v3', queries: applicationQueriesV3, ... } }`
// would still type-check), so this test exists to catch that class of bug at
// runtime.
describe('useApplicationConfig', () => {
  afterEach(() => jest.clearAllMocks());

  it('resolves to the V2 queries and DTOs for a v2 tenant', () => {
    setVersion('v2');

    const config = useApplicationConfig();

    expect(config.queries).toBe(applicationQueriesV2);
    expect(config.PostFormDto).toBe(PostApplicationFormDtoV2);
    expect(config.PutFormDto).toBe(PutApplicationFormDtoV2);
  });

  it('resolves to the V3 queries and DTOs for a v3 tenant', () => {
    setVersion('v3');

    const config = useApplicationConfig();

    expect(config.queries).toBe(applicationQueriesV3);
    expect(config.PostFormDto).toBe(PostApplicationFormDtoV3);
    expect(config.PutFormDto).toBe(PutApplicationFormDtoV3);
  });
});
