import 'reflect-metadata';

jest.mock('../../helpers', () => ({
  useTeamEdfiTenantNavContextLoaded: jest.fn(),
}));

// Importing the real './profileConfig' below transitively pulls in the real
// '../../api' barrel (that's the whole point of this spec — see comment
// below), which in turn loads api/methods.ts -> config/config.ts, whose
// `import.meta.env` Jest cannot parse. Mock just the config module (not
// '../../api' itself) to isolate that unrelated module-load-time failure
// without faking the queries this test needs to be real.
jest.mock('../../../config/config', () => ({
  config: { showRequestCertification: false, apiUrl: '/api' },
}));

// Same rationale as the config/config mock above: the real '../../api'
// barrel also re-exports queries.ts (unrelated to Profile), which imports
// the ESM-only 'kebab-case' package that Jest's transform can't parse.
// Stub it with an identity function so the real module graph can load.
jest.mock('kebab-case', () => (str: string) => str);

import {
  PostProfileDtoV2,
  PostProfileDtoV3,
  PutProfileDtoV2,
  PutProfileDtoV3,
} from '@edanalytics/models';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { profileQueriesV2, profileQueriesV3 } from '../../api';
import { useProfileConfig } from './profileConfig';

const mockUseNavContext = useTeamEdfiTenantNavContextLoaded as jest.Mock;

const setVersion = (version: 'v2' | 'v3') => {
  mockUseNavContext.mockReturnValue({ edfiTenant: { sbEnvironment: { version } } });
};

// This spec deliberately does NOT mock './profileConfig' — every other
// Profile spec does, which means the real useProfileConfig() -> version ->
// profileQueriesV2/V3 resolution built by createVersionedResource is never
// exercised anywhere else. createVersionedResource does not catch a
// mis-keyed branch at compile time (e.g. `{ v3: { version: 'v3', queries:
// profileQueriesV2, ... } }` would still type-check), so this test exists to
// catch that class of bug at runtime.
describe('useProfileConfig', () => {
  afterEach(() => jest.clearAllMocks());

  it('resolves to the V2 queries and DTOs for a v2 tenant', () => {
    setVersion('v2');

    const config = useProfileConfig();

    expect(config.queries).toBe(profileQueriesV2);
    expect(config.PostDto).toBe(PostProfileDtoV2);
    expect(config.PutDto).toBe(PutProfileDtoV2);
  });

  it('resolves to the V3 queries and DTOs for a v3 tenant', () => {
    setVersion('v3');

    const config = useProfileConfig();

    expect(config.queries).toBe(profileQueriesV3);
    expect(config.PostDto).toBe(PostProfileDtoV3);
    expect(config.PutDto).toBe(PutProfileDtoV3);
  });
});
