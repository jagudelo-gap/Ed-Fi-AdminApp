# AC-527 Vendor Management V3 Frontend — Design

## Context

The backend V3 vendor CRUD (AC-524/AC-526) is complete and stable. This is
frontend-only work: give V3-specification tenants the same Vendor list,
create, view, edit, and delete experience that V2 tenants already have, with
no changes to V1 or V2 Vendor behavior.

## Key findings that shape this design

- `GetVendorDtoV3` / `PostVendorDtoV3` / `PutVendorDtoV3` (in
  `packages/models/src/dtos/edfi-admin-api.v3.dto.ts`) are structurally
  identical to their V2 counterparts — both extend the same V1 base
  (`PostVendorDto`) without adding fields.
- The query builder (`packages/fe/src/app/api/queries/builder.ts`) already
  resolves the admin-api URL segment dynamically from
  `edfiTenant.sbEnvironment.version`, so a V3 query builder needs no special
  path handling.
- `SbaaAdminApiVersion` already includes `'v3'`, and `VersioningHoc` already
  accepts a `v3` prop — the route-level plumbing for V3 already exists, it's
  just unused for Vendor today.
- Every Vendor component already reads `edfiTenant` (and therefore
  `edfiTenant.sbEnvironment.version`) via `useTeamEdfiTenantNavContextLoaded()`.
- V1's DTO fields are also structurally compatible, but V1 is explicitly out
  of scope for this ticket (different tenant-resolution semantics, legacy
  credential flow, and the ticket's own scope boundary forbids touching V1
  behavior). This design intentionally does not fold V1 in.

## Approach: version-aware `VendorV2Plus` surface (not a duplicated `VendorV3` folder)

Duplicating `Pages/VendorV2` into `Pages/VendorV3` would produce two folders
with byte-for-byte identical forms, table columns, and actions, diverging
only in which query-builder/DTO classes they call. Instead, extend the
existing V2 surface to resolve its query set and DTO classes per-tenant at
runtime, and rename the folder `VendorV2Plus` to make the "V2 and later, not
V1" scope explicit and intentional rather than an accidental omission.

### 1. Shared versioned-resource factory (new, reusable across AC-528/529/530)

New file `packages/fe/src/app/api/queries/versioned.ts`:

```ts
export type VersionedResourceKey = 'v2' | 'v3';

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
  // its own narrowed branch instead. See "Task 1 follow-up" below for why
  // this was added and how to use it.
  useVersionedResource.match = function useVersionedResourceMatch<R>(
    handlers: { [K in Config['version']]: (cfg: Extract<Config, { version: K }>) => R }
  ): R {
    const cfg = useVersionedResource();
    const handler = handlers[cfg.version as Config['version']];
    return handler(cfg as Extract<Config, { version: typeof cfg.version }>);
  };

  return useVersionedResource;
}
```

**Note (post-implementation, differs from the original sketch above the
line):** the shipped factory requires `Config extends { version: string }`,
and each `byVersion` branch writes its own `version` literal explicitly
(`{ v2: { version: 'v2', ... }, v3: { version: 'v3', ... } }`) rather than
the factory auto-injecting it via a distributive mapped type. This was
simplified during implementation. The resulting discriminated union is
equivalent for callers (`useVendorConfig()` still returns
`{version:'v2';...} | {version:'v3';...}`), but two things follow from this:

- Callers must keep each branch's literal `version` field in sync with its
  object key by eye — the compiler does not catch a mis-keyed branch (e.g.
  `{ v2: { version: 'v3', ... } }` would still type-check). Double-check this
  when adding a new entity's config.
- The factory now also exposes a `.match()` method (shown above), added as
  a follow-up to the initial PR #280 review. See "Task 1 follow-up" below —
  this changes the recommended consumer pattern from what point 3 originally
  said about field-level divergence.

V1 is deliberately excluded from `VersionedResourceKey` — this factory is
for the "V2Plus" pattern only. AC-528/529/530 (Application, Claimset,
Profile, ApiClient) can reuse this factory verbatim with their own
per-entity config shape — each entity's config file supplies the per-version
data (`queries`, DTO classes, etc.) plus each branch's own `version` literal:

```ts
export type VendorConfig =
  | { version: 'v2'; queries: typeof vendorQueriesV2; PostDto: typeof PostVendorDtoV2; PutDto: typeof PutVendorDtoV2 }
  | { version: 'v3'; queries: typeof vendorQueriesV3; PostDto: typeof PostVendorDtoV3; PutDto: typeof PutVendorDtoV3 };

export const useVendorConfig = createVersionedResource<VendorConfig>({
  v2: { version: 'v2', queries: vendorQueriesV2, PostDto: PostVendorDtoV2, PutDto: PutVendorDtoV2 },
  v3: { version: 'v3', queries: vendorQueriesV3, PostDto: PostVendorDtoV3, PutDto: PutVendorDtoV3 },
});
// useVendorConfig(): { version: 'v2'; queries: typeof vendorQueriesV2; ... }
//                  | { version: 'v3'; queries: typeof vendorQueriesV3; ... }
```

**Why the union must stay discriminated at the type level, not just at the
declaration site:** if a caller instead wrote `Config` as one flattened,
non-discriminated type (or the factory's generic collapsed the branches into
a single shape), `useVendorConfig().queries` would become a union of two
distinct function types (`vendorQueriesV2['getOne'] | vendorQueriesV3['getOne']`).
Calling it still type-checks, but the result —
`UseQueryOptions<GetVendorDtoV2> | UseQueryOptions<GetVendorDtoV3>` — is a
union of two different generic instantiations, and passing that into
`useQuery()` fails: TypeScript can't pick a single overload of a generic,
overloaded function from a union argument. `vendor`'s inferred type
(`GetVendorDtoV2 | GetVendorDtoV3 | undefined`) and the `useQuery` call
itself both become unresolvable. Keeping the union distributive (as above)
avoids this — react-query's generic overload widens `TQueryFnData` to
`GetVendorDtoV2 | GetVendorDtoV3` in one call instead of being handed two
incompatible calls to choose between.

**Remaining caveat (superseded — see "Task 1 follow-up" below):** this
correlation only holds at the point `useVendorConfig()` is called —
destructuring `const { queries, PostDto } = useVendorConfig()` in a consumer
doesn't stop TypeScript from later pairing `queries` from one branch with a
DTO from the other. That was safe for the initial Vendor implementation only
because `GetVendorDtoV2`/`GetVendorDtoV3` (and their Post/Put counterparts)
are structurally identical. Post-implementation, `CreateVendorPage.tsx` and
`EditVendor.tsx` were changed to use `.match()` instead of destructuring
precisely to close this gap before a real V2/V3 divergence hits it — see
below.

### 2. API layer: add `vendorQueriesV3` and a per-version config

In `queries.v7.ts`, add `vendorQueriesV3` mirroring `vendorQueriesV2`, built
with `GetVendorDtoV3` / `PostVendorDtoV3` / `PutVendorDtoV3`.

New file `Pages/VendorV2Plus/vendorConfig.ts`:

```ts
export const useVendorConfig = createVersionedResource<VendorConfig>({
  v2: { version: 'v2', queries: vendorQueriesV2, PostDto: PostVendorDtoV2, PutDto: PutVendorDtoV2 },
  v3: { version: 'v3', queries: vendorQueriesV3, PostDto: PostVendorDtoV3, PutDto: PutVendorDtoV3 },
});
```

Bundling `queries` + DTO classes + `version` into one config object means
components never write a `version === 'v3' ? X : Y` conditional for the
common case. `version` is exposed on the config so a future field-level
divergence (see "Task 1 follow-up" below) can still branch narrowly without
changing this factory's shape.

### 3. Component changes: `Pages/VendorV2` → `Pages/VendorV2Plus`

Each component (`VendorsPage`, `VendorPage`, `ViewVendor`, `EditVendor`,
`CreateVendorPage`, `NameCell`, `useVendorActions`) swaps its direct
`vendorQueriesV2` import for `useVendorConfig().queries`. The two spots that
need a specific DTO class use the config's `PostDto`/`PutDto` instead of a
hardcoded one.

Everywhere else (table columns, view fields, actions) is untouched — it
runs against whichever DTO the config resolves to, since today's fields are
identical across V2/V3.

**Post-implementation update (PR #280 follow-up, Task 1):** the two form
components — `CreateVendorPage.tsx` and `EditVendor.tsx` — no longer call
`classValidatorResolver(useVendorConfig().PostDto)`/`.PutDto` directly.
Destructuring `useVendorConfig()` erases the version correlation at the type
level (see point 1's caveat), so both were rewritten to dispatch via
`useVendorConfig.match({ v2: ..., v3: ... })` into a shared, generic inner
form component instantiated once per branch:

```tsx
// CreateVendorPage.tsx
export const CreateVendorV2 = () =>
  useVendorConfig.match({
    v2: (cfg) => <CreateVendorForm<PostVendorDtoV2> config={cfg} />,
    v3: (cfg) => <CreateVendorForm<PostVendorDtoV3> config={cfg} />,
  });

function CreateVendorForm<D extends PostVendorDtoV2 | PostVendorDtoV3>(props: {
  config: { queries: { post: typeof vendorQueriesV2.post }; PostDto: new () => D };
}) {
  const { queries, PostDto } = props.config;
  const resolver = useMemo(() => classValidatorResolver(PostDto), [PostDto]);
  const { register, handleSubmit, formState: { errors } } = useForm<D>({
    resolver,
    defaultValues: new PostDto() as DefaultValues<D>,
  });
  // register()/errors access use small `field`/`errorMessage` helper casts —
  // see "Task 1 follow-up" below for why those are needed and what they
  // do (and don't) protect against.
  ...
}
```

`EditVendor.tsx` follows the same shape (`EditVendorForm<D>`). This ties
`new PostDto()`/`new PutDto()` and the data ultimately passed to
`mutateAsync` to the *actual* resolved branch's DTO type, not the wider
`PostVendorDtoV2 | PostVendorDtoV3` union — closing the gap the point 1
caveat originally flagged as unenforced. See "Task 1 follow-up" below for
the full mechanics, the two casts this requires, and a worked example of
what happens (and what to do) when V2/V3 fields actually diverge.

### 3a. Task 1 follow-up: what actually happens when V2/V3 diverge (worked example)

This section exists because the guidance the design originally gave here —
"the relevant component adds one narrow conditional... rather than a
parallel component tree" — undersold how much friction react-hook-form
actually adds once a field genuinely diverges between versions. This is
written from a real, verified experiment (temporarily adding a field to
`PutVendorDtoV3` only and rebuilding), not a hypothetical, so it should
generalize to Application/Claimset/Profile/ApiClient (AC-528/529/530) when
they hit the same situation.

**Step 1 — the shared body already stops you from doing it wrong.**
Suppose V3 adds a `myExample: string` field to `PutVendorDtoV3` that V2
doesn't have. If you try to wire it into the *shared* `EditVendorForm` body
the same way as the other fields —

```tsx
<Input {...register(field('myExample'))} />
<FormErrorMessage>{errorMessage('myExample')}</FormErrorMessage>
```

— it fails to compile:

```
error TS2345: Argument of type '"myExample"' is not assignable to parameter of type
'"id" | "displayName" | "company" | "namespacePrefixes" | "contactName" | "contactEmailAddress"'.
```

This is `field`/`errorMessage`'s parameter type — `keyof PutVendorDtoV2 &
keyof PutVendorDtoV3` — doing its job: a field name that doesn't exist on
*both* branches is rejected before it reaches `register`/`errors`. (Adding a
real field to one branch's DTO can also surface a second, independent error
at the `useVendorConfig.match({...})` call site, because the branch's
`queries.put(...)` mutation-result type diverges too — another layer
catching the same underlying divergence.)

**Step 2 — the compiler stops you, it doesn't hand you the fix.** To
actually add `myExample` for v3 only, thread `version` through the config
prop and branch in JSX, with a separately-typed `register`/error accessor
scoped to the v3-only field (not the V2∩V3 intersection `field`/
`errorMessage` use for shared fields):

```tsx
function EditVendorForm<D extends PutVendorDtoV2 | PutVendorDtoV3>(props: {
  config: { version: 'v2' | 'v3'; queries: {...}; PutDto: new () => D };
  vendor: VendorEntity;
}) {
  ...
  // Scoped to the v3-only field. Same generic-vs-abstract-D limitation as
  // `field`/`errorMessage` above — this cast is unavoidable for the same
  // reason, just narrowed to fields that exist on only one branch.
  const v3Field = (name: keyof PutVendorDtoV3) => name as Path<D>;
  const v3ErrorMessage = (name: keyof PutVendorDtoV3): string | undefined =>
    (errors as Record<string, { message?: unknown } | undefined>)[name]?.message as
      | string
      | undefined;

  return (
    <chakra.form ...>
      {/* ...shared fields via field()/errorMessage()... */}
      {props.config.version === 'v3' && (
        <FormControl isInvalid={!!(errors as Record<string, unknown>).myExample}>
          <FormLabel>My Example</FormLabel>
          <Input {...register(v3Field('myExample'))} />
          <FormErrorMessage>{v3ErrorMessage('myExample')}</FormErrorMessage>
        </FormControl>
      )}
    </chakra.form>
  );
}
```

**Why this is still the right shape (not a sign to abandon the pattern):**
the cast count doesn't grow with the number of shared fields — it grows only
with the number of fields that actually diverge, and each new cast is
localized to exactly the field it covers. The alternative (two fully
separate components) avoids casts entirely but reintroduces the duplication
this design was written to avoid for the non-divergent fields, which is the
common case in practice. Reach for the fully-separate-component shape only
if a future entity's V2/V3 forms diverge so extensively that the shared body
is mostly `version === 'v3'` branches — at that point the shared function is
no longer saving real duplication and the generic-cast overhead stops paying
for itself.

**Root cause, so the next person doesn't re-diagnose it:**
react-hook-form's `DefaultValues<T>`/`Path<T>`/`FieldErrors<T>` are
conditional/mapped types that don't specialize against a bare generic type
parameter — even one constrained to a concrete union
(`D extends PutVendorDtoV2 | PutVendorDtoV3`). TypeScript checks a generic
function's body against the abstract `D`, not against the concrete type
each call site (`EditVendorForm<PutVendorDtoV2>` vs. `<PutVendorDtoV3>`)
supplies, so these library-provided helper types can't resolve field names
or nested key types from `D` alone. This is a known limitation of writing
generic wrapper components over react-hook-form, not something specific to
this codebase — the casts in `field`/`errorMessage`/`v3Field`/
`v3ErrorMessage` above are the accepted workaround, and they're narrow
enough that they don't weaken the actual protection this design cares about
(the DTO shape reaching `mutateAsync` stays fully checked against `D`,
uncast).

### 4. Routing (`vendor.routes.tsx`)

Add `v3` branches pointing at the same (now version-aware) components, no
new route paths:

```tsx
<VersioningHoc v1={<VendorPage />} v2={<VendorPageV2 />} v3={<VendorPageV2 />} />
```

Applied to the vendors-index, vendor-detail, create, and breadcrumb routes.

### 5. Error handling

An unmapped/unsupported version throws inside `useVersionedResource()`,
caught by the existing page-level `ErrorBoundary` pattern already used for
`VendorPageTitle`, rather than silently falling back to V2 behavior for a
V3 tenant.

### 6. Testing

- Unit test `createVersionedResource` (v2 selection, v3 selection, throws on
  an unmapped version, and — added in the Task 1 follow-up — `.match()`
  calling the correct branch's handler with a correctly-narrowed argument
  and leaving the other handler untouched; see `versioned.spec.ts`).
- Exercise existing VendorV2Plus test patterns (if any) against V3
  fixtures/DTOs to confirm identical CRUD behavior.
- Manual/E2E regression check: V1 and V2 tenant Vendor pages remain
  behavior-identical to before this change, per the ticket's explicit scope
  boundary.

## Explicit scope boundaries (carried from 527.md)

**In scope:** Vendor list, create, view, edit, delete for V3-specification
tenants, matching existing V2 UX/fields exactly.

**Out of scope:** Any change to V1 Vendor pages/behavior; any change to V2
Vendor behavior (internal refactor only); any other V3 entity (Application,
Claimset, Profile, ApiClient — AC-528/529/530).
