import {
  PostApplicationFormDtoV2,
  PostApplicationFormDtoV3,
  PutApplicationFormDtoV2,
  PutApplicationFormDtoV3,
} from '@edanalytics/models';
// Import builders directly from queries.v7, NOT the `../../api` barrel: the
// barrel participates in a circular import that can leave these builders
// `undefined` when a config module is captured mid-init in the production
// bundle. See vendorConfig.ts and
// docs/design/admin-api-v3-support/README.md ("Config modules must bypass
// the api barrel") for the full mechanism.
import { applicationQueriesV2, applicationQueriesV3 } from '../../api/queries/queries.v7';
import { createVersionedResource } from '../../api/queries/versioned';

// Re-exported for existing consumers/imports of `./applicationConfig` — the
// type and helper themselves live in applicationEntity.ts, which has no
// dependency on the query-builder chain below, so specs that mock this whole
// module can still pull in the real `getDataStoreIds` without dragging that
// chain (and its ESM-only packages) into Jest.
export { getDataStoreIds } from './applicationEntity';
export type { ApplicationEntity } from './applicationEntity';

export type ApplicationConfig =
  | {
      version: 'v2';
      queries: typeof applicationQueriesV2;
      PostFormDto: typeof PostApplicationFormDtoV2;
      PutFormDto: typeof PutApplicationFormDtoV2;
    }
  | {
      version: 'v3';
      queries: typeof applicationQueriesV3;
      PostFormDto: typeof PostApplicationFormDtoV3;
      PutFormDto: typeof PutApplicationFormDtoV3;
    };

export const useApplicationConfig = createVersionedResource<ApplicationConfig>({
  v2: {
    version: 'v2',
    queries: applicationQueriesV2,
    PostFormDto: PostApplicationFormDtoV2,
    PutFormDto: PutApplicationFormDtoV2,
  },
  v3: {
    version: 'v3',
    queries: applicationQueriesV3,
    PostFormDto: PostApplicationFormDtoV3,
    PutFormDto: PutApplicationFormDtoV3,
  },
});
