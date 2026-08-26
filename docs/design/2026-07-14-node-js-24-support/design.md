# Node.js 24 Support — Design

## Summary

Move AdminApp's entire runtime footprint — local development, CI, and production
containers — from Node.js 22 to Node.js 24, ahead of Node 22's end-of-life (April
2027). This is a mechanical version-reference bump plus verification; it does not
change application behavior.

## Current State

| File | Current value |
|---|---|
| `.nvmrc` | `22.23.0` |
| `package.json` (`engines.node`) | `>=22.0.0` |
| `packages/api/package.json` (`engines.node`) | `>=22.0.0` |
| `packages/api/Dockerfile` (build + runtime stages) | `node:22-alpine@sha256:b2358485e3e33bc3a33114d2b1bdb18cdbe4df01bd2b257198eb51beb1f026c5` |
| `packages/fe/Dockerfile` (build stage) | `node:22-alpine@sha256:b2358485e3e33bc3a33114d2b1bdb18cdbe4df01bd2b257198eb51beb1f026c5` |
| `.github/workflows/on-pullrequest.yml` | `node-version-file: '.nvmrc'` (4 steps) — already reads from `.nvmrc` |
| `.github/workflows/on-prerelease.yml` | hardcoded `node-version: '22.x'` (2 steps) |
| `.github/workflows/run-e2e-ui.yml` | hardcoded `node-version: 22.23.0` (1 step) |
| `.github/workflows/copilot-setup-steps.yml` | no Node reference at all (Postgres bootstrap only) |

No native Node modules (`binding.gyp` / native `node-gyp` build steps) exist in the
dependency tree, which reduces the risk of Node-24-incompatible compiled addons.

## Design

### 1. Single source of truth for the Node version

`.nvmrc` becomes the only place the exact Node version is pinned. It is updated to
the latest Node 24 LTS patch release available at implementation time (matching the
existing exact-patch pinning style, e.g. `24.x.y`).

`package.json`'s root `engines.node` and `packages/api/package.json`'s
`engines.node` are both updated from `>=22.0.0` to `>=24.0.0`, preserving the
existing range-style convention (not switched to an exact pin).

### 2. CI workflow standardization

All three CI workflows that reference a Node version are updated to read from
`.nvmrc` via `node-version-file: '.nvmrc'`, rather than mixing hardcoded versions
with `.nvmrc`-sourced ones:

- `on-prerelease.yml`: replace both hardcoded `node-version: '22.x'` steps with
  `node-version-file: '.nvmrc'`.
- `run-e2e-ui.yml`: replace the hardcoded `node-version: 22.23.0` step with
  `node-version-file: '.nvmrc'`.
- `on-pullrequest.yml`: no change — already sources from `.nvmrc`.

This means a future Node version bump only requires editing `.nvmrc` in these three
workflows, instead of three separate files with three different patterns.

`copilot-setup-steps.yml` is left unchanged — it does not set up Node at all today
(it only bootstraps a local Postgres instance), so there is nothing in it to bump.
This corrects the task brief's assumption that it needed a Node version update.

### 3. Docker base images

`packages/api/Dockerfile` (both the `build` and `runtime` stages) and
`packages/fe/Dockerfile` (the `build` stage) are updated from
`node:22-alpine@sha256:...` to `node:24-alpine@sha256:...`, pinned by digest for the
same Node 24 patch version chosen for `.nvmrc`, preserving the existing
digest-pinning practice.

### 4. Dependency compatibility bumps

No dependencies are bumped preemptively. Verification (below) will surface any
package whose installed version is incompatible with Node 24 (via an `engines`
conflict, install failure, or test failure). Only those specific packages are bumped,
and only to the minimum version that restores Node 24 compatibility — no unrelated
upgrades, and no new packages are introduced, per the task's scope boundary.

### 5. Verification

- Install dependencies, build, and run the full existing test suite (unit and e2e)
  locally under the new Node 24 version.
- Push the branch and confirm the updated CI workflows (PR, prerelease, e2e-ui)
  build and test successfully on Node 24.
- Per the confirmed release-gating assumption: if any dependency incompatibility,
  native-module failure, or test breakage surfaces during verification that can't be
  resolved via an in-scope compatibility bump, this change defers entirely to release
  4.2 instead of being patched around with workarounds or scope-expanding fixes.

## Error Handling

There is no runtime error-handling surface for this change — it is a build/deploy
configuration change, not application logic. The only "failure mode" is verification
failure (install/build/test breakage on Node 24), which is handled by the release
deferral rule above rather than by code-level error handling.

## Testing

No new tests are added (no behavior changes to test). The existing unit and e2e test
suites, run unmodified under Node 24, are themselves the verification mechanism for
this change, per the Success Criteria.

## Out of Scope (unchanged from task brief)

- Upgrading dependencies not required for Node 24 compatibility.
- Any application functionality/behavior change.
- Adding new third-party packages.
- Creating or targeting a release branch.
