# AC-568 Profile Management V3 Frontend — Design

## Context

The backend V3 Profile CRUD already exists (`admin-api.v3.service.ts`:
`getProfiles`/`postProfile`/`getProfile`/`putProfile`/`deleteProfile`). This is
frontend-only work: give V3-specification tenants the same Profile list,
create, view, edit, and delete experience that V2 tenants already have, with
no changes to V2 Profile behavior.

This ticket reuses the pattern established in
[AC-527](./527-design.md) (Vendor V3) verbatim. **This document only covers
what's specific to Profile** — for the mechanics of `createVersionedResource`,
`.match()`, why destructuring a versioned config directly into `useForm()` is
unsafe, and the worked example of what to do when V2/V3 fields actually
diverge, see `527-design.md` sections 1 and 3a. None of that is repeated here.

## Key findings that shape this design

- `GetProfileDtoV2`/`V3`, `PostProfileDtoV2`/`V3`, `PutProfileDtoV2`/`V3` (in
  `packages/models/src/dtos/edfi-admin-api.v{2,3}.dto.ts`) are structurally
  identical — `id`, `name`, `definition` on all three, nothing else. Same
  situation as Vendor.
- **V1 never supported Profiles at all** — `admin-api.v1.service.ts` has no
  Profile methods (`getProfiles`/`postProfile`/etc. don't exist there). This
  differs from Vendor, which had a real V1 implementation and its own legacy
  `Pages/Vendor` folder. There is no V1 Profile folder to preserve, because
  none was ever built.
- The Profiles nav link is already version-gated in
  `packages/fe/src/app/Layout/TeamNav.tsx:348`:
  `sbEnvironment?.version === 'v2'` — the same shape the Vendor gates had
  before AC-527 widened them. This needs the same widening:
  `sbEnvironment?.version !== 'v1'`.
- `packages/fe/src/app/routes/profile.routes.tsx` does not use `VersioningHoc`
  at all today — it renders `<ProfilePageV2 />`/`<CreateProfile />`
  unconditionally regardless of tenant version, relying entirely on the nav
  gate above to keep v1 users from reaching it organically. A v1 tenant
  hitting a Profile URL directly today gets the V2 page and V2 queries
  against a backend with no v1 Profile endpoints — an unguarded, uncontrolled
  failure mode, not a deliberate one.
- `CreateProfilePage.tsx`/`EditProfile.tsx` have an XML-file-upload flow
  (`handleFileChange`: parses an uploaded `.xml`, calls
  `setValue('name', ...)`/`setValue('definition', ...)`) that Vendor's forms
  don't have. It carries over into the version-aware form unchanged — both
  fields it sets are shared across V2/V3, so it doesn't interact with the
  divergence-safety pattern at all.

## Approach: rename `Pages/Profile` → `Pages/ProfileV2Plus` (no separate v1 folder)

Unlike Vendor (`Pages/Vendor` v1 + `Pages/VendorV2` → `VendorV2Plus`), there is
no legacy v1 Profile folder to keep separate — the existing `Pages/Profile`
folder already plays the role Vendor's `VendorV2` folder played pre-527, not
the role of a v1 legacy folder. So this is a straight `git mv Pages/Profile
Pages/ProfileV2Plus` plus the edits below, with nothing left behind under the
old name.

### 1. API layer: add `profileQueriesV3`

In `queries.v7.ts`, add `profileQueriesV3` mirroring `profileQueriesV2`, built
with `GetProfileDtoV3`/`PostProfileDtoV3`/`PutProfileDtoV3`.

### 2. New file: `Pages/ProfileV2Plus/profileConfig.ts`

Mirrors `vendorConfig.ts` exactly, including the `version` literal per
branch and the `.match()` method (reused verbatim from `versioned.ts` — no
changes needed there):

```ts
export type ProfileEntity = GetProfileDtoV2 | GetProfileDtoV3;

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

export const useProfileConfig = createVersionedResource<ProfileConfig>({
  v2: { version: 'v2', queries: profileQueriesV2, PostDto: PostProfileDtoV2, PutDto: PutProfileDtoV2 },
  v3: { version: 'v3', queries: profileQueriesV3, PostDto: PostProfileDtoV3, PutDto: PutProfileDtoV3 },
});
```

**Note (post-implementation, found during Task 5):** do not add an explicit
`: () => ProfileConfig` return-type annotation to `useProfileConfig` as shown
in an earlier draft of this sample. Annotating the const's type this way
erases the `.match` static property that `createVersionedResource` attaches
to the returned function — `.match()` call sites still type-check (because
the annotation widens the type to a plain function signature) but fail at
runtime with no compile error pointing back here. Let TypeScript infer the
type instead, as shown above.

### 3. Component changes — two different patterns, deliberately

**Read-only pages (`ProfilesPage.tsx`, `ProfilePage.tsx`, `NameCell.tsx`,
`useProfileActions.tsx`) use the plain hook, not `.match()`.** These only ever
read `queries` off the config and pass it into `useQuery`/mutation calls —
there's no DTO *instantiation* involved, so there's no pairing-drift risk (see
527-design.md's caveat on why writes are riskier than reads). Swap the
hardcoded `profileQueriesV2` import for `const { queries } = useProfileConfig();`,
and swap `GetProfileDtoV2` type annotations for `ProfileEntity`. This mirrors
`VendorsPage.tsx`/`VendorPage.tsx`/`NameCell.tsx`/`useVendorActions.tsx`
exactly — those also use the plain hook, not `.match()`, for the same reason.

**Form pages (`CreateProfilePage.tsx`, `EditProfile.tsx`) use `.match()`.**
Same shape as `CreateVendorPage.tsx`/`EditVendor.tsx`: an outer component
dispatches on the resolved version into a shared generic form component,
typed to the concrete branch instead of the `PostProfileDtoV2 | V3` union:

```tsx
export const CreateProfile = () =>
  useProfileConfig.match({
    v2: (cfg) => <CreateProfileForm<PostProfileDtoV2> config={cfg} />,
    v3: (cfg) => <CreateProfileForm<PostProfileDtoV3> config={cfg} />,
  });

function CreateProfileForm<D extends PostProfileDtoV2 | PostProfileDtoV3>(props: {
  config: { queries: { post: typeof profileQueriesV2.post }; PostDto: new () => D };
}) {
  // Same field()/errorMessage() intersection-typed helper pattern as
  // CreateVendorForm — see 527-design.md section 3a for why these casts
  // are needed and what they do (and don't) protect against.
  // handleFileChange (XML parsing) moves here unchanged: it only calls
  // setValue('name', ...)/setValue('definition', ...), both shared fields.
  ...
}
```

`EditProfile.tsx` follows the same shape (`EditProfileForm<D>`), same as
`EditVendorForm`.

### 4. Routing (`profile.routes.tsx`)

Wrap the index/create/detail/breadcrumb routes in `VersioningHoc` with `v2`
and `v3` branches pointing at the same version-aware pages — **no `v1`
branch provided**, matching `useProfileConfig`'s v1 exclusion. Component
export names stay as they are today (`ProfilesPage`, `ProfilePageV2`,
`CreateProfile`) — the folder rename to `ProfileV2Plus` signals the version
scope, individual export names don't need a matching suffix, same convention
Vendor already follows (`VendorsPageV2`, `VendorPageV2`, `CreateVendorV2`
all live under the `VendorV2Plus` folder):

```tsx
export const profilesIndexRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/profiles/',
  element: <VersioningHoc v2={<ProfilesPage />} v3={<ProfilesPage />} />,
};
export const profileIndexRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/profiles/:profileId/',
  element: <VersioningHoc v2={<ProfilePageV2 />} v3={<ProfilePageV2 />} />,
};
export const profileCreateRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/profiles/create',
  element: <VersioningHoc v2={<CreateProfile />} v3={<CreateProfile />} />,
  handle: { crumb: () => 'Create Profile' },
};
```

`VersioningHoc` renders `null` when the current version has no matching
branch (`packages/fe/src/app/helpers/VersioningHoc.tsx`), so this changes a
v1 tenant hitting a Profile URL directly from an uncontrolled backend error
to a graceful blank render. This is a deliberate, low-risk improvement to v1
behavior (confirmed with the ticket owner) — unlike AC-527, which had a real
V1 page to leave untouched, there is no equivalent v1 behavior worth
preserving here; today's unconditional-V2-render-for-v1 was never a
deliberate design, just an artifact of `VersioningHoc` never having been
wired up for Profile routes.

Dedupe the `ProfileBreadcrumb` component the same way `VendorBreadcrumbV2Plus`
was deduped in AC-527's Task 4 follow-up (`vendor.routes.tsx`): a small
`createVersionedResource` scoped to just the breadcrumb's `getOne` query,
shared between v2/v3 instead of two near-identical components.

### 5. `TeamNav.tsx`

Widen the Profiles nav-visibility gate at line 348 from
`sbEnvironment?.version === 'v2'` to `sbEnvironment?.version !== 'v1'` —
identical fix shape to the Vendor gates AC-527 widened in
`useSbEnvironmentGlobalActions.tsx`.

### 6. Error handling

Unmapped/unsupported version throws inside `useProfileConfig()` (from
`createVersionedResource`, unchanged), same as Vendor. At the route level,
the new `VersioningHoc` wrapping (section 4) means a v1 tenant never reaches
a component that would call `useProfileConfig()` and throw — it renders
`null` one layer up instead.

### 7. Testing

Same coverage shape as Vendor's test suite:
- `CreateProfilePage.spec.tsx`/`EditProfile.spec.tsx`: assert the correct
  version-selected mutation (`post`/`put`) and DTO class are used, for both
  v2 and v3 branches — mirroring `CreateVendorPage.spec.tsx`/
  `EditVendor.spec.tsx`.
- `ProfilesPage.spec.tsx`/`useProfileActions.spec.tsx` (new, matching
  `VendorsPage.spec.tsx`/`useVendorActions.spec.tsx`): assert the
  version-selected `queries.getAll`/`queries.delete` are used.
- No new test needed in `versioned.spec.ts` — `createVersionedResource`
  and `.match()` are reused unchanged and already covered there.
- Manual/E2E regression check: V2 tenant Profile pages remain
  behavior-identical to before this change.

## Explicit scope boundaries

**In scope:** Profile list, create, view, edit, delete for V3-specification
tenants, matching existing V2 UX/fields exactly. The `VersioningHoc`
v1-hardening described in section 4 (confirmed low-risk, in scope).

**Out of scope:** Any change to V2 Profile behavior (internal refactor
only); any other V3 entity (Application, Claimset, ApiClient); retrofitting
Vendor's read-only pages to any different pattern (not needed — Vendor
already uses the plain-hook-for-reads pattern this design also uses).
