import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';

export type VersionedResourceKey = 'v2' | 'v3';

/**
 * Build a hook that resolves a per-admin-api-version config object (queries,
 * DTO classes, whatever a page needs) from the current tenant's resolved
 * version. V1 is intentionally excluded — this is for the "V2 and later"
 * pattern only.
 *
 * `Config` should be a discriminated union keyed on `version` (see
 * VendorConfig for the pattern). The compiler does NOT enforce that a given
 * `byVersion` branch's `version` field matches its object key — every branch
 * is typed as the whole `Config` union, so a mis-keyed/copy-pasted branch
 * (e.g. `{ v2: { version: 'v3', ... } }`) will still type-check. Double-check
 * each branch by eye when adding a new entity's config.
 */
export function createVersionedResource<Config extends { version: string }>(
  byVersion: Partial<Record<VersionedResourceKey, Config>>
) {
  function useVersionedResource(): Config {
    const { edfiTenant } = useTeamEdfiTenantNavContextLoaded();
    const version = edfiTenant.sbEnvironment.version;
    const resource = version ? byVersion[version as VersionedResourceKey] : undefined;
    if (!resource) {
      throw new Error(`No resource registered for admin API version "${version}"`);
    }
    return resource;
  }

  // Branches on the discriminant without destructuring first — destructuring
  // (e.g. `const { queries, PostDto } = useVendorConfig()`) erases the
  // version correlation at the type level, because `queries`/`PostDto` end up
  // typed as a union across branches. `.match()` keeps each handler scoped to
  // its own narrowed branch instead.
  useVersionedResource.match = function useVersionedResourceMatch<R>(
    handlers: { [K in Config['version']]: (cfg: Extract<Config, { version: K }>) => R }
  ): R {
    const cfg = useVersionedResource();
    const handler = handlers[cfg.version as Config['version']];
    return handler(cfg as Extract<Config, { version: typeof cfg.version }>);
  };

  return useVersionedResource;
}
