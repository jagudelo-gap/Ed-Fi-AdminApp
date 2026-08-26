import {
  GetProfileDtoV2,
  GetProfileDtoV3,
  PostProfileDtoV2,
  PostProfileDtoV3,
  PutProfileDtoV2,
  PutProfileDtoV3,
} from '@edanalytics/models';
// Import builders directly from queries.v7, NOT the `../../api` barrel: the
// barrel participates in a circular import that can leave these builders
// `undefined` when a config module is captured mid-init in the production bundle.
// See claimsetConfig.ts and docs/design/admin-api-v3-support/README.md ("Config
// modules must bypass the api barrel") for the full mechanism.
import { profileQueriesV2, profileQueriesV3 } from '../../api/queries/queries.v7';
import { createVersionedResource } from '../../api/queries/versioned';

export type ProfileEntity = GetProfileDtoV2 | GetProfileDtoV3;

// A true discriminated union: each branch ties `version` to the matching
// `queries`/`PostDto`/`PutDto` set. See vendorConfig.ts and
// 527-design.md section 1 for the full rationale and the
// destructure-erases-correlation caveat this pattern exists to avoid.
export type ProfileConfig =
  | {
      version: 'v2';
      queries: typeof profileQueriesV2;
      PostDto: typeof PostProfileDtoV2;
      PutDto: typeof PutProfileDtoV2;
    }
  | {
      version: 'v3';
      queries: typeof profileQueriesV3;
      PostDto: typeof PostProfileDtoV3;
      PutDto: typeof PutProfileDtoV3;
    };

// Do NOT add an explicit `: () => ProfileConfig` return-type annotation here.
// It silently erases the `.match` static property `createVersionedResource`
// attaches to the returned function — every `.match()` call site would still
// type-check, but fail at runtime, with no compile error pointing back here.
export const useProfileConfig = createVersionedResource<ProfileConfig>({
  v2: {
    version: 'v2',
    queries: profileQueriesV2,
    PostDto: PostProfileDtoV2,
    PutDto: PutProfileDtoV2,
  },
  v3: {
    version: 'v3',
    queries: profileQueriesV3,
    PostDto: PostProfileDtoV3,
    PutDto: PutProfileDtoV3,
  },
});
