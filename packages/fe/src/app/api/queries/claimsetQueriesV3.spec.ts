import 'reflect-metadata';

// builder.ts imports the ESM-only 'kebab-case' package that Jest's Babel
// transform can't parse (same reason applicationConfig.spec.ts and
// profileConfig.spec.ts mock it). EntityQueryBuilder only uses it to derive
// the URL segment name, which is irrelevant to what this spec asserts.
jest.mock('kebab-case', () => (str: string) => str);

// claimsetQueriesV3's mutation factories (`.post(...)`) call React's
// `useMutation`/`useQueryClient` internally, so invoking them requires those
// hooks to resolve synchronously outside of any component. Mocking
// '@tanstack/react-query' to hand back the raw config object (rather than a
// real mutation object) lets us call the captured `mutationFn` directly and
// assert on the URL/DTO it hands to `methods.post` — without a live
// QueryClient or React render tree.
jest.mock('@tanstack/react-query', () => ({
  useMutation: jest.fn((config: unknown) => config),
  useQueryClient: jest.fn(() => ({ invalidateQueries: jest.fn() })),
}));

// Mocking '../methods' avoids pulling in methods.ts -> config/config.ts's
// `import.meta.env`, which Jest's Babel transform can't parse (same reason
// ClaimsetPage.spec.tsx mocks '../../api'). It also gives us a spy to inspect
// exactly what URL and ReqDto class each mutation posts with.
jest.mock('../methods', () => ({
  methods: {
    post: jest.fn().mockResolvedValue({ id: 1 }),
    getOne: jest.fn(),
    getManyMap: jest.fn(),
  },
}));

import { GetEdfiTenantDto } from '@edanalytics/models';
import { ImportClaimsetSingleDtoV2, ImportClaimsetSingleDtoV3 } from '@edanalytics/models';
import { claimsetQueriesV3 } from './queries.v7';
import { methods } from '../methods';

const mockPost = methods.post as jest.Mock;

// Minimal stub satisfying what `standardPath`/`EntityQueryBuilder` read off
// `edfiTenant` (`.id` and `.sbEnvironment.version`).
const edfiTenant = {
  id: 3,
  sbEnvironmentId: 2,
  sbEnvironment: { version: 'v3' },
} as unknown as GetEdfiTenantDto;

describe('claimsetQueriesV3 wiring', () => {
  afterEach(() => jest.clearAllMocks());

  it('createExport posts to the v3 export path with the selected ids', () => {
    const mutation = claimsetQueriesV3.createExport({ edfiTenant, teamId: 1 }) as unknown as {
      mutationFn: (args: { entity: object; pathParams: { ids: number[] } }) => unknown;
    };

    mutation.mutationFn({ entity: {}, pathParams: { ids: [1, 2] } });

    const [url] = mockPost.mock.calls[0];
    expect(url).toContain('admin-api/v3/');
    expect(url).toContain('claimsets/export?id=1&id=2');
  });

  it('import posts to the v3 import path using the V3 request DTO, not the V2 one', () => {
    const mutation = claimsetQueriesV3.import({ edfiTenant, teamId: 1 }) as unknown as {
      mutationFn: (args: { entity: object; pathParams: object }) => unknown;
    };

    mutation.mutationFn({ entity: { name: 'x', resourceClaims: [] }, pathParams: {} });

    const [url, ReqDto] = mockPost.mock.calls[0];
    expect(url).toContain('admin-api/v3/');
    expect(url).toContain('claimsets/import');
    // A mis-wired builder (e.g. reusing ImportClaimsetSingleDtoV2) would
    // typecheck and pass every other test — this is the guard against that.
    expect(ReqDto).toBe(ImportClaimsetSingleDtoV3);
    expect(ReqDto).not.toBe(ImportClaimsetSingleDtoV2);
  });
});
