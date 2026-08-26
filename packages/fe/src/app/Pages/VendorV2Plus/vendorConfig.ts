import {
  GetVendorDtoV2,
  GetVendorDtoV3,
  PostVendorDtoV2,
  PostVendorDtoV3,
  PutVendorDtoV2,
  PutVendorDtoV3,
} from '@edanalytics/models';
// Import builders directly from queries.v7, NOT the `../../api` barrel: the
// barrel participates in a circular import that can leave these builders
// `undefined` when a config module is captured mid-init in the production bundle.
// See claimsetConfig.ts and docs/design/admin-api-v3-support/README.md ("Config
// modules must bypass the api barrel") for the full mechanism.
import { vendorQueriesV2, vendorQueriesV3 } from '../../api/queries/queries.v7';
import { createVersionedResource } from '../../api/queries/versioned';

export type VendorEntity = GetVendorDtoV2 | GetVendorDtoV3;

// A true discriminated union: each branch ties `version` to the matching
// `queries`/`PostDto`/`PutDto` set, so the two branches can't mix-and-match
// members from each other.
//
// Caveat for future V3 entities reusing this pattern: destructuring
// `const { queries, PostDto } = useVendorConfig()` in a consumer does NOT
// preserve the version correlation at the type level — TypeScript only ties
// the members together at this declaration site, not across a later
// destructure. This works transparently for Vendor only because
// PostVendorDtoV2/V3 (and Put/Get) are structurally identical empty
// subclasses; if a future entity's V2/V3 DTOs actually diverge in shape, the
// same destructure-then-consume pattern can reproduce a real type mismatch
// at the mutateAsync call site. Consumers should prefer `useVendorConfig
// .match({ v2: ..., v3: ... })`, which narrows each branch without
// destructuring (see CreateVendorPage.tsx/EditVendor.tsx).
export type VendorConfig =
  | {
      version: 'v2';
      queries: typeof vendorQueriesV2;
      PostDto: typeof PostVendorDtoV2;
      PutDto: typeof PutVendorDtoV2;
    }
  | {
      version: 'v3';
      queries: typeof vendorQueriesV3;
      PostDto: typeof PostVendorDtoV3;
      PutDto: typeof PutVendorDtoV3;
    };

export const useVendorConfig = createVersionedResource<VendorConfig>({
  v2: {
    version: 'v2',
    queries: vendorQueriesV2,
    PostDto: PostVendorDtoV2,
    PutDto: PutVendorDtoV2,
  },
  v3: {
    version: 'v3',
    queries: vendorQueriesV3,
    PostDto: PostVendorDtoV3,
    PutDto: PutVendorDtoV3,
  },
});
