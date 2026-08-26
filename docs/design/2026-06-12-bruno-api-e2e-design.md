# Bruno E2E Design for Admin App API (App/Auth Tags)

## 1. Goal and Scope

Create a Bruno-based API E2E suite under `tests/api` for local Docker Compose environments, focused on endpoints tagged **App** and **Auth**.

This phase includes:
- Bruno CLI execution.
- OIDC authentication via Keycloak using script-driven token retrieval.
- Support for both `client_credentials` and `password` grants.
- API-safe Auth endpoints only (no browser redirect flows).
- A reusable PowerShell runner that can run all tests, by tag, or by specific endpoint/request.
- Optional service startup using `compose\start-services.ps1`.
- Initial CI workflow design aligned with local execution.

This phase excludes:
- Browser login redirect endpoint automation (`/auth/login/*`, `/auth/callback/*`, `/auth/logout`).
- Full payload-level comprehensive validation for every endpoint.

## 2. Target Endpoints

### App tag
- `GET /healthcheck`
- `GET /secret/:secretId` (smoke/negative where practical)

### Auth tag (API-call safe)
- `GET /auth/me`
- `GET /auth/my-teams`
- `GET /auth/cache`
- `GET /auth/cache/:teamId`

## 3. Proposed File Layout

```text
tests/
  api/
    bruno.json
    environments/
      local.bru
      ci.bru (optional starter)
    collections/
      app/
        healthcheck.bru
        secret.bru
      auth/
        me.bru
        my-teams.bru
        cache.bru
        cache-team.bru
    scripts/
      pre-request.js (if needed for shared headers)
      assertions.js (if needed for shared assertions)
    run-bruno.ps1
    README.md

eng/
  bootstrap-keycloak-for-tests.ps1
```

## 4. Authentication and Bootstrap Design

### 4.1 Runtime token acquisition
`tests/api/run-bruno.ps1` obtains an access token before invoking Bruno:
- Default grant: configurable (default `client_credentials`).
- Alternate grant: `password`.
- Token endpoint pattern:
  - `https://localhost/auth/realms/edfi/protocol/openid-connect/token`

The runner exports variables consumed by Bruno environment/requests:
- `BASE_URL` (default `https://localhost/adminapp-api/api`)
- `ACCESS_TOKEN`
- `TENANT` (optional)
- OIDC values (`OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_USERNAME`, etc.)

### 4.2 Keycloak/bootstrap script
`eng/bootstrap-keycloak-for-tests.ps1` is idempotent and prepares prerequisites:
1. Ensure client settings allow both required grants.
2. Upsert test user (defaults to configured `ADMIN_USERNAME` when available).
3. Seed test data through API calls:
   - Create/find team via `POST /api/teams`.
   - Create/find team membership via `POST /api/teams/{teamId}/user-team-memberships`.
4. Optional SQL fallback path (PostgreSQL/MSSQL) only if API seeding cannot run due bootstrap constraints.

## 5. Runner Script UX (`tests/api/run-bruno.ps1`)

### Inputs (parameters)
- `-StartServices` (optional): run `compose\start-services.ps1` first.
- `-BootstrapAuth` (optional): run `eng\bootstrap-keycloak-for-tests.ps1`.
- `-SeedData` (optional): ensure team/membership fixtures.
- `-GrantType` (`client_credentials` | `password`).
- `-Tag` (`App` | `Auth`).
- `-Request` (specific Bruno request name/path).
- `-Collection` (optional collection filter).
- `-Env` (default `local`).

### Execution modes
- All tests: no filter.
- By tag: map tag to collection/request filters.
- By specific endpoint/request: run single request target.

### Behavior
- Fail fast on setup/auth failures.
- Non-zero exit on Bruno failures.
- Print actionable diagnostics without leaking secrets.

## 6. Bruno Collection Design

### Common request conventions
- Authorization header: `Bearer {{ACCESS_TOKEN}}` where required.
- Base URL usage: `{{BASE_URL}}/...`
- Optional tenant header variable where endpoint behavior requires it.

### Assertion level for phase 1
- Smoke happy-path status checks (2xx).
- Key auth negatives for protected endpoints (401/403).
- Light response shape checks for critical endpoints.

## 7. Local Preconditions

- Docker is installed and running.
- Compose stack available from `compose`.
- Bruno CLI is installed and available in PATH.
- User can run:
  - `tests/api/run-bruno.ps1 -StartServices -BootstrapAuth -SeedData`
  - or run compose manually beforehand.

## 8. README Content Plan (`tests/api/README.md`)

The README will include:
1. Purpose and scope of App/Auth E2E tests.
2. Prerequisites.
3. Required/optional environment variables.
4. Run commands:
   - all tests
   - by tag
   - by endpoint/request
5. Auth/bootstrap/seed flow explanations.
6. Troubleshooting for token, TLS, and service readiness issues.

## 9. Initial GitHub Actions Design (Future Phase)

Use the same runner script in CI to avoid drift:
1. Checkout repo.
2. Start compose services (or dedicated CI service setup).
3. Wait for required health endpoints.
4. Run `run-bruno.ps1` with CI environment settings/secrets.
5. Execute desired mode(s): all and/or tag-based matrix.
6. Publish artifacts (Bruno output/logs).

### CI configuration considerations
- Secrets for client credentials and test user password.
- Potential self-hosted runner requirement if Docker Compose stack is needed.
- Optional `ci.bru` environment file with non-secret defaults.

## 10. Risks and Mitigations

- **Risk:** Keycloak/client config drift across environments.  
  **Mitigation:** idempotent bootstrap script, explicit parameterized settings.

- **Risk:** Data seeding conflicts or duplicates.  
  **Mitigation:** create-or-find semantics and stable fixture naming.

- **Risk:** TLS/certificate issues in local Docker setup.  
  **Mitigation:** documented flags and explicit token/request diagnostics.

## 11. Success Criteria

- Tests run via Bruno CLI from `tests/api`.
- Runner supports all, tag, and specific endpoint/request execution.
- OIDC token can be acquired using both supported grant types.
- Auth bootstrap and seed flow is reproducible locally.
- App/Auth smoke + key auth-negative scenarios pass in local compose setup.
