# ESLint Cleanup + Pre-Commit Enforcement Design

## Problem

`npm run lint:check` currently reports 757 problems (128 errors, 629 warnings) across the repo. `npm run lint:fix` resolves only the mechanically auto-fixable subset. No pre-commit enforcement exists, so lint regressions can land on `main` unchecked.

## Current State

- Flat ESLint config at `eslint.config.mjs`, built on `@nx/eslint-plugin`, `plugin:jest/recommended`, `plugin:jest/style`, `eslint:recommended`, `plugin:storybook/recommended`, plus per-package `.eslintrc.json` files.
- No Husky, no lint-staged, no `.husky/` directory — commits are not currently gated on lint.
- `tests/e2e/.features-gen/**` is generated output from `playwright-bdd` (`npx bddgen`), not hand-written.

### Findings breakdown (by rule)

| Rule | Count | Notes |
|---|---|---|
| `@typescript-eslint/no-explicit-any` | ~405 | warning; bulk of the work |
| `@typescript-eslint/no-unused-vars` | ~140 | warning; mostly dead imports/params |
| `no-empty-pattern` | 51 | error; nearly all in `tests/e2e/**` Playwright fixture destructuring (`async ({}, use) => {}`), plus some in generated `.features-gen` output |
| `jest/no-conditional-expect` | 22 | warning |
| `@typescript-eslint/no-unused-expressions` | 21 | error; jest spec files |
| `storybook/no-renderer-packages` | 7 | error; direct `@storybook/react` import instead of framework package |
| `jest/no-jasmine-globals` | 6 | error |
| `no-undef` (console) | 6 | error |
| `@typescript-eslint/no-empty-function` | 6 | warning |
| `jest/no-commented-out-tests` | 2 | warning |
| `jest/no-export` | 2 | error |
| `no-var` | 1 | error; auto-fixable |

## Goals

1. Fix all 757 currently-reported problems.
2. Add a pre-commit hook that blocks commits containing any lint error or warning (`--max-warnings 0`) on staged files.
3. Where a lint rule is firing on code that is actually correct (e.g. Playwright fixture destructuring, generated output), fix the *config*, not the code.

## Non-Goals

- No repo-wide type-safety overhaul beyond what's needed to clear `no-explicit-any` at reported sites.
- No change to existing per-package `.eslintrc.json` philosophy beyond the two overrides described below.
- No CI-level lint gate in this pass (pre-commit hook only, per request).

## Approach

### Phase 1 — Config fixes + auto-fix

1. **Ignore generated e2e output.** Add `'**/tests/e2e/.features-gen'` to the `ignores` array in `eslint.config.mjs`. Regenerating via `bddgen` would otherwise reintroduce any hand-fix.
2. **Allow empty patterns in e2e step definitions.** Add a config block scoped to `files: ['tests/e2e/**/*.ts']` (excluding `.features-gen`, already ignored) that sets `'no-empty-pattern': 'off'` — Playwright's fixture-destructuring convention (`async ({}, use) => {...}`) is not a bug.
3. **Storybook renderer imports.** For the 7 sites importing `@storybook/react` directly, switch to the framework package already used by this repo's Storybook config (`@storybook/react-vite`, confirmed via `packages/*/​.storybook/main.ts` build config) — no rule change needed, this is a real fix.
4. **Run `npm run lint:fix`.** Clears `no-var` and any other mechanically auto-fixable findings.
5. Re-run `npm run lint:check` to get an updated, smaller problem count before Phase 2.

### Phase 2 — Manual fixes

Work package-by-package (`api`, `fe`, `models`, `models-server`, `utils`, `common-ui`, `tests/e2e`), running `npx eslint <package-path>` after each to confirm zero remaining before moving to the next.

- **`no-explicit-any`**: replace with real types/interfaces inferable from surrounding context (DTOs, request/response shapes, existing generics). Use `unknown` + type guard/narrowing only where a concrete type can't be derived without disproportionate effort.
- **`no-unused-vars`**: delete unused imports and unused local variables outright. Prefix with `_` only where a function signature must keep the parameter position (matches existing repo convention already seen on `_data`, `_options`, `_queueName`, etc).
- **`no-unused-expressions`** (jest specs): inspect each site — typically a missing `await` before an assertion-returning call, or a stray expression statement. Fix per actual cause.
- **`jest/no-conditional-expect`**: restructure so the assertion isn't inside an `if`/`catch` branch — use `.rejects`/`.resolves` or assert unconditionally on both branches.
- **`no-empty-function`**: give empty constructors/arrow functions a body, or remove them if truly dead.
- **`jest/no-jasmine-globals`** (`fail(...)`): replace with `throw new Error(...)` or the `done.fail` callback per site.
- **`no-undef`** (`console`): add `console` to the applicable env/globals for the affected files (likely CLI/script files missing a Node env), or replace with the project's logger if one exists.
- **`jest/no-commented-out-tests`**: remove the commented-out test code, or restore it to a working test if still relevant (confirm intent per site).
- **`jest/no-export`**: remove the export from the test file, or move the exported helper to a non-test module.

### Pre-commit hook

1. Add `husky` and `lint-staged` as devDependencies.
2. Add `"prepare": "husky"` script to root `package.json` so the hook installs on `npm install`.
3. `.husky/pre-commit`:
   ```sh
   npx lint-staged
   ```
4. Root `package.json` `lint-staged` config:
   ```json
   {
     "lint-staged": {
       "*.{ts,tsx,js,jsx}": "eslint --max-warnings 0"
     }
   }
   ```
   Only staged files are linted (fast), but any error or warning on a staged file blocks the commit.

Because Phase 2 clears every existing finding first, the hook starts green — no baseline exceptions or grandfathering needed.

## Testing / Verification

- After Phase 1: `npm run lint:check` shows a reduced, expected problem count (only Phase 2 categories remain).
- After Phase 2: `npm run lint:check` exits 0 with zero problems.
- Hook verification: stage a file with a deliberately introduced lint error, attempt `git commit`, confirm it's rejected; remove the error, confirm commit succeeds.
- No functional/runtime behavior changes are expected from Phase 2 (types and dead-code removal only) — existing test suites (`test:api`, `test:fe`, `test:models`, etc.) must still pass after each package's fixes.

## Risks

- Real type derivation for ~405 `no-explicit-any` sites is the largest time sink; some may reveal genuine latent type mismatches once typed correctly — treat those as real bugs to fix, not just lint noise.
- `--max-warnings 0` pre-commit gate is strict: any future legitimate warning-triggering pattern (e.g. a new Playwright fixture outside the overridden path) will block commits until config or code is adjusted. Acceptable per explicit choice to go strict now rather than grandfather warnings.
