# Unit Test Coverage Improvement Design

**Date:** 2026-05-27  
**Scope:** `packages/api`, `packages/utils`, `packages/models`, `packages/models-server`  
**Goal:** Add unit tests for all classes, interfaces, and functions that currently have no associated test, following a bottom-up dependency-layer strategy to maximize code coverage and test reliability.

---

## 1. Background & Motivation

The `packages/api` project (NestJS backend) and its supporting packages currently have sparse unit-test coverage:

| Package | Existing spec files | Source files without tests (approx.) |
|---|---|---|
| `packages/utils` | 1 | 7 |
| `packages/models` | 0 | ~10 with testable logic |
| `packages/models-server` | 0 | ~2 |
| `packages/api` | 13 | ~100+ (utilities, services, controllers) |

The goal is not to add tests for every file blindly but to cover every file that contains **testable logic** — functions with branches, transformations, validation, or behavior that can break silently.

---

## 2. Out of Scope

The following file types have no testable logic and are explicitly excluded:

- **NestJS module files** (`*.module.ts`) — pure dependency injection wiring
- **Entry point** (`main.ts`) — bootstraps the app
- **Database config files** (`typeorm.config.ts`, `migrations.datasource.ts`, `database-config.service.ts`) — environment-driven config, no branches
- **Mode files** (`modes/prod.ts`, `modes/dev.ts`) — simple environment flags
- **OIDC strategy** (`auth/login/oidc.strategy.ts`) — requires a live identity provider
- **Migration SQL files** (partially) — SQL strings are tested via a structural smoke test pattern (see Phase 7)
- **Pure interface/type files** — contain no runtime code
- **`index.ts` barrel files** — re-exports only

---

## 3. Test Conventions

### 3.1 File Placement

Test files are co-located next to the source file, following the existing project pattern:

```
packages/utils/src/lib/string-sanitize.ts
packages/utils/src/lib/string-sanitize.spec.ts   ← new
```

### 3.2 Test Framework

Jest is used in all packages. Each package already has a `jest.config.ts` and `tsconfig.spec.json`. No new tooling is introduced.

### 3.3 Pure Utility Tests

No mocks or DI needed. Test all logical branches, edge cases, and expected error throws:

```ts
describe('sanitizeForUrl', () => {
  it('converts to lowercase', () => expect(sanitizeForUrl('Hello')).toBe('hello'));
  it('replaces spaces with dashes', () => expect(sanitizeForUrl('a b')).toBe('a-b'));
  it('removes special chars', () => expect(sanitizeForUrl('a!b')).toBe('ab'));
});
```

### 3.4 NestJS Service Tests

Use `@nestjs/testing` `Test.createTestingModule()` with in-memory mock repositories:

```ts
const mockRepo = {
  findOneByOrFail: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  remove: jest.fn(),
};

beforeEach(async () => {
  const module = await Test.createTestingModule({
    providers: [
      UsersGlobalService,
      { provide: getRepositoryToken(User), useValue: mockRepo },
    ],
  }).compile();
  service = module.get(UsersGlobalService);
});
```

### 3.5 NestJS Controller Tests

Use `Test.createTestingModule()` with mock services. Test that controller methods delegate to services with the correct arguments and return the expected shape:

```ts
const mockService = { findOne: jest.fn(), create: jest.fn(), ... };

beforeEach(async () => {
  const module = await Test.createTestingModule({
    controllers: [UsersGlobalController],
    providers: [{ provide: UsersGlobalService, useValue: mockService }],
  }).compile();
  controller = module.get(UsersGlobalController);
});
```

### 3.6 Migration Smoke Tests

Each migration is instantiated and its `up`/`down` methods are verified to exist and be async functions. No live database is required:

```ts
import { Initial1688158300508 } from './1687190483471-initial';

describe('Initial migration', () => {
  const migration = new Initial1688158300508();

  it('has an up method', () => expect(typeof migration.up).toBe('function'));
  it('has a down method', () => expect(typeof migration.down).toBe('function'));
  it('up returns a Promise', () => {
    const result = migration.up({ query: jest.fn().mockResolvedValue(undefined) } as any);
    expect(result).toBeInstanceOf(Promise);
  });
});
```

---

## 4. Implementation Phases

### Phase 1 — `packages/utils` (7 files)

All utility functions are pure — no dependencies, no mocks needed. These are the highest-ROI tests.

| File | Key behaviors to test |
|---|---|
| `create-concurrency-limiter.ts` | Enforces concurrency limit; queues excess tasks; resolves in order |
| `string-sanitize.ts` | `sanitizeForUrl`: lowercase, whitespace→dash, strip specials; `trimTrailingSlashes`: single/multiple/none |
| `set-operations.ts` | `intersection`: common elements; `union`: merge; `isSuperset`: true/false cases. **Note:** functions are currently unexported — they must be exported (`export const`) before they can be tested directly. |
| `join-strs-nice.ts` | 0, 1, 2, 3+ items; Oxford-comma-style formatting |
| `date-formats.ts` | Format functions with valid and edge-case dates |
| `wait.ts` | Returns a Promise; resolves after the given delay (use fake timers) |
| `form-err-from-validator.ts` | Maps validation errors to form error structures |

---

### Phase 2 — `packages/models` (testable utilities and decorators)

These files contain real logic: validation, serialization, and class-validator decorator registration.

| File | Key behaviors to test |
|---|---|
| `utils/validate-privileges.ts` | Valid privilege set passes; missing dependency fails with correct message; unknown privilege throws |
| `utils/TrimWhitespace.ts` | Decorator trims leading/trailing whitespace on string properties |
| `utils/make-serializer.ts` | Serializes entity to DTO; omits/maps fields correctly |
| `utils/is-arn.ts` | Valid ARN patterns return true; invalid patterns return false |
| `utils/getApplicationCacheId.ts` | Returns stable cache key for given inputs |
| `utils/regarding.ts` | Returns correctly formatted display string |
| `decorators/conditional-validation.decorator.ts` | Decorator applies validation only when condition is met |

**Note:** Pure interface/type files (`interfaces/`, `enums/`, `dtos/`) contain no runtime logic and are excluded unless they export functions.

---

### Phase 3 — `packages/models-server` (~2 files)

| File | Key behaviors to test |
|---|---|
| `helpers/index.ts` | `addUserModifying` sets `modifiedById`; `addUserCreating` sets `createdById`; `regarding` returns formatted string with display name and entity type |
| `utils/entity-base.ts` | Base entity fields are present; timestamps are auto-set |

---

### Phase 4 — `packages/api/src/utils` and `auth/helpers` (~8 files)

| File | Key behaviors to test |
|---|---|
| `utils/db-json-query.ts` | `jsonValue` returns correct SQL fragment for `mssql` and `pgsql` engines |
| `utils/applyDtoUpdates.ts` | Only whitelisted fields are applied; non-listed fields are ignored; returns mutated entity |
| `utils/throwNotFound.ts` | Throws `NotFoundException` with correct message |
| `utils/customExceptions.ts` | Each custom exception carries the right HTTP status and message |
| `app/aggregate-error-handler.ts` | `isAggregateError` detects correctly; `handle` classifies DB vs non-DB errors; `extractAllMessages` returns all error strings |
| `auth/helpers/where-ids.ts` | Builds TypeORM `In` clause from Set/array inputs |
| `auth/authorization/authorize.decorator.ts` | Decorator sets correct metadata |
| `auth/authorization/public.decorator.ts` | Marks route as public via metadata |

---

### Phase 5 — `packages/api` Services (~25 services)

Each service is tested with mock TypeORM repositories and/or mock dependent services. Coverage targets: CRUD paths, error propagation, and any non-trivial business logic.

| Service | Test focus |
|---|---|
| `users-global/users-global.service.ts` | `create`, `findOne`, `findByUsername`, `update` (allowed fields only), `remove` |
| `roles-global/roles-global.service.ts` | CRUD + privilege validation |
| `teams-global/teams-global.service.ts` | CRUD + membership logic |
| `edfi-tenants-global/edfi-tenants-global.service.ts` | CRUD + tenant config |
| `edfi-tenants-global/odss-global/odss-global.service.ts` | ODS CRUD |
| `edfi-tenants-global/edorgs-global/edorgs-global.service.ts` | EdOrg CRUD |
| `ownerships-global/ownerships-global.service.ts` | Ownership creation/removal |
| `user-team-memberships-global/user-team-memberships-global.service.ts` | Membership CRUD |
| `sb-environments-global/sb-environments-global.service.ts` | SB environment CRUD |
| `sb-environments-global/sb-environments-edfi.services.ts` | EdFi tenant linkage |
| `teams/users/users.service.ts` | Team-scoped user operations |
| `teams/roles/roles.service.ts` | Team-scoped role operations |
| `teams/ownerships/ownerships.service.ts` | Team-scoped ownership operations |
| `teams/user-team-memberships/user-team-memberships.service.ts` | Team membership operations |
| `teams/sb-environments/sb-environments.service.ts` | Team SB env operations |
| `teams/edfi-tenants/edfi-tenants.service.ts` | Team EdFi tenant operations |
| `teams/edfi-tenants/edorgs/edorgs.service.ts` | (already has spec — verify/extend) |
| `teams/edfi-tenants/odss/odss.service.ts` | (already has spec — verify/extend) |
| `teams/edfi-tenants/starting-blocks/v1/admin-api.v1.service.ts` | (already has spec — verify/extend) |
| `teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service.ts` | (already has spec — verify/extend) |
| `teams/edfi-tenants/starting-blocks/v2/starting-blocks.v2.service.ts` | SB v2 sync flow |
| `teams/edfi-tenants/starting-blocks/v2/ods-rowcount.service.ts` | Row count fetch and error handling |
| `certification/certification.service.ts` | Certification lifecycle |
| `certification/catalog/catalog.service.ts` | (already has spec — verify/extend) |
| `certification/artifact/artifact.service.ts` | (already has spec — verify/extend) |
| `auth/auth.service.ts` | Session management, login/logout logic |
| `app/health.service.ts` | Health check returns correct status |
| `app/app.service.ts` | App-level service delegation |
| `integration-apps-team/integration-apps-team.service.ts` | Integration app CRUD |
| `sb-sync/edfi/adminapi-sync.service.ts` | (already has spec — verify/extend) |

---

### Phase 6 — `packages/api` Controllers (~15 controllers)

Controllers are thin delegation layers. Tests verify correct HTTP method routing, service delegation, and response shape using `@nestjs/testing`.

| Controller | Test focus |
|---|---|
| `users-global/users-global.controller.ts` | GET/POST/PUT/DELETE delegate to service; response shape |
| `roles-global/roles-global.controller.ts` | Same pattern |
| `teams/teams-global.controller.ts` | Team CRUD routes |
| `edfi-tenants-global/edfi-tenants-global.controller.ts` | Tenant CRUD routes |
| `edfi-tenants-global/odss-global/odss-global.controller.ts` | ODS routes |
| `ownerships-global/ownerships-global.controller.ts` | Ownership routes |
| `user-team-memberships-global/user-team-memberships-global.controller.ts` | Membership routes |
| `sb-environments-global/sb-environments-global.controller.ts` | SB env routes |
| `teams/users/users.controller.ts` | Team-scoped user routes |
| `teams/roles/roles.controller.ts` | Team-scoped role routes |
| `teams/ownerships/ownerships.controller.ts` | Team ownership routes |
| `teams/sb-environments/sb-environments.controller.ts` | Team SB env routes |
| `teams/edfi-tenants/edfi-tenants.controller.ts` | Team EdFi tenant routes |
| `integration-apps-team/integration-apps-team.controller.ts` | Integration app routes |
| `auth/auth.controller.ts` | Login/logout/me routes |
| `app/app.controller.ts` | Root controller routes |
| `certification/certification.controller.ts` | Certification routes |

---

### Phase 7 — Migration Smoke Tests (~40 migrations)

Rather than testing individual SQL strings (brittle), migration smoke tests verify:
1. The migration class can be instantiated
2. The `up` method exists and returns a `Promise`
3. The `down` method exists and returns a `Promise` (or is absent for irreversible migrations)

One `*.spec.ts` file per migration. Because migration files are numerous, a **single shared test helper** is used:

```ts
// packages/api/src/database/migrations/migration-smoke-test.helper.ts
export function describeMigration(MigrationClass: new () => { up: Function; down?: Function }) {
  const migration = new MigrationClass();
  const queryRunner = { query: jest.fn().mockResolvedValue(undefined) } as any;

  it('has an up method', () => expect(typeof migration.up).toBe('function'));
  it('up returns a Promise', () => expect(migration.up(queryRunner)).toBeInstanceOf(Promise));

  if (migration.down) {
    it('has a down method', () => expect(typeof migration.down).toBe('function'));
    it('down returns a Promise', () => expect(migration.down!(queryRunner)).toBeInstanceOf(Promise));
  }
}
```

Then each migration spec is just:

```ts
import { describeMigration } from '../migration-smoke-test.helper';
import { Initial1688158300508 } from './1687190483471-initial';

describe('Migration: Initial1688158300508', () => {
  describeMigration(Initial1688158300508);
});
```

---

## 5. Success Criteria

- All files listed in Phases 1–4 have co-located `*.spec.ts` files.
- All services listed in Phase 5 have `*.spec.ts` files with tests covering happy path CRUD operations and at least one error/edge case per method.
- All controllers listed in Phase 6 have `*.spec.ts` files verifying delegation and response shape.
- All migration files in Phase 7 have `*.spec.ts` smoke tests using the shared helper.
- `npm run test:api` passes with no new failures.
- Code coverage (branch + line) shows measurable improvement over baseline.

---

## 6. Dependencies & Prerequisites

- No new packages or build tools are required.
- Tests run with the existing `npm run test:api` (for `packages/api`) and equivalent commands for other packages.
- Existing test infrastructure (`jest.config.ts`, `tsconfig.spec.json`) is already in place for all four packages.
