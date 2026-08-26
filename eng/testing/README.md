# E2E Testing

This folder contains two independent end-to-end test suites for the Admin App:

- **[API Bruno E2E Tests](#api-bruno-e2e-tests)** (`run-bruno.ps1`) — Bruno CLI-driven API endpoint tests.
- **[UI Playwright E2E Tests](#ui-playwright-e2e-tests)** (`run-e2e-ui.ps1`) — Playwright BDD-driven browser UI tests.

## API Bruno E2E Tests

Bruno CLI-driven end-to-end test suite for Admin App API App/Auth endpoints with Keycloak OIDC authentication bootstrap and local runner automation.

### Prerequisites

- **Bruno CLI** installed and available in PATH
- **PowerShell** (Windows PowerShell 5.1+)
- **Docker & Docker Compose** for running services locally
- Local development environment set up (optionally via `eng\helpers\start-all-services-test-docker.ps1`)

### Configuration

#### Environment Variables

The runner script uses these environment variables (with defaults for local development):

```powershell
# Keycloak/OIDC Configuration
$env:OIDC_ISSUER = 'https://localhost/auth/realms/edfi'          # Keycloak issuer URL
$env:OIDC_CLIENT_ID = 'edfiadminapp-machine'                     # Client ID
$env:OIDC_CLIENT_SECRET = 'edfi-machine-secret-456'              # Client secret
$env:OIDC_USERNAME = 'edfi-admin'                                # Test user username
$env:OIDC_PASSWORD = '123'                                       # Test user password
$env:OIDC_ADMIN_USER = 'admin'                                   # Keycloak admin user
$env:OIDC_ADMIN_PASSWORD = 'admin'                               # Keycloak admin password

# API Configuration
$env:API_BASE_URL = 'https://localhost/adminapp-api/api'         # Admin App API base URL
$env:BASE_URL = 'https://localhost/adminapp-api/api'             # Alternative API base (set by runner)
$env:ACCESS_TOKEN = ''                                           # Bearer token (acquired by runner)
$env:TEAM_ID = ''                                                # Test team ID (set by bootstrap)
$env:TENANT = ''                                                 # Multi-tenant identifier (if needed)
```

#### Environments

Two Bruno environment configurations are provided:

- **`environments/local.bru`** — Local development defaults
- **`environments/ci.bru`** — CI/CD defaults (non-secret values)

### Quick Start

Run these commands from the repository root.

#### Run All Tests

```powershell
.\eng\testing\run-bruno.ps1 -Env local
```

#### Run Tests with Services & Bootstrap

Starts Docker Compose, bootstraps Keycloak, seeds test data, and runs all tests:

```powershell
.\eng\testing\run-bruno.ps1 -Env local -StartServices -BootstrapAuth -SeedData
```

#### Run by Tag

Run only App endpoints:

```powershell
.\eng\testing\run-bruno.ps1 -Env local -Tag App
```

Run only Auth endpoints:

```powershell
.\eng\testing\run-bruno.ps1 -Env local -Tag Auth
```

#### Run Specific Request

Run a single request by name:

```powershell
.\eng\testing\run-bruno.ps1 -Env local -Request auth-me
```

#### Custom OIDC Grant Type

Use password grant instead of client_credentials:

```powershell
.\eng\testing\run-bruno.ps1 -Env local -GrantType password
```

### Available Requests

#### App Collection (`tests/api/collections/app/`)

| Request | Description | Tag | Auth |
|---------|-------------|-----|------|
| `app-healthcheck` | GET `/healthcheck` — API health check | App | None |
| `app-secret` | GET `/secret/{id}` — Secret retrieval | App | None |

#### Auth Collection (`tests/api/collections/auth/`)

| Request | Description | Tag | Auth |
|---------|-------------|-----|------|
| `auth-me` | GET `/auth/me` with Bearer token | Auth | Required |
| `auth-me-no-token` | GET `/auth/me` without token (negative test) | Auth | None |
| `auth-my-teams` | GET `/auth/my-teams` — User's team list | Auth | Required |
| `auth-cache` | GET `/auth/cache` — Cache status | Auth | Required |
| `auth-cache-team` | GET `/auth/cache/{teamId}` — Team cache status | Auth | Required |

### Bootstrap & Seed Process

#### Keycloak Bootstrap (`eng\helpers\bootstrap-keycloak-for-tests.ps1`)

Automatically called by the runner with `-BootstrapAuth`:

1. **Acquires admin token** from Keycloak (`admin-cli` client)
2. **Creates/updates client** `edfiadminapp-machine` with service-account and `login:app` scope configuration
3. **Upserts test users** for the browser login (`edfi-admin`) and machine client (`edfiadminapp-machine`)
4. **Seeds test data** directly in the database (teams, memberships)

#### Idempotency

All bootstrap operations are idempotent:
- Existing clients and users are detected and skipped
- Team creation checks for duplicates by name
- Membership creation handles "already exists" errors gracefully

#### Fallback Behavior

If Keycloak is unavailable:
- Machine-user seeding and team/membership setup happen directly in the database
- Keycloak client provisioning errors are logged as warnings

### Troubleshooting

#### Services Not Running

**Error:** `Failed to acquire token: Unable to connect to the remote server`

**Solution:** Start services first:

```powershell
.\eng\helpers\start-all-services-test-docker.ps1
```

#### BASE_URL Not Resolved

**Error:** `app-healthcheck` request fails with URL resolution error

**Solution:** Ensure the environment file is loaded:

```powershell
.\eng\testing\run-bruno.ps1 -Env local
```

#### Token Acquisition Fails

**Error:** `Failed to acquire access token: ...`

**Causes:**
- Keycloak not running
- Wrong `OIDC_CLIENT_SECRET`
- Client `edfiadminapp-machine` not configured in Keycloak

**Solutions:**
1. Verify Keycloak is running: `docker ps | grep keycloak`
2. Run bootstrap: `.\eng\testing\run-bruno.ps1 -BootstrapAuth`
3. Check Keycloak admin console at `https://localhost/auth/`

#### Tests Failing with 502 Bad Gateway

**Cause:** API is not running or misconfigured

**Solution:**
```powershell
# Rebuild and restart services
.\eng\helpers\start-all-services-test-docker.ps1

# Wait a few seconds for services to be ready
Start-Sleep -Seconds 10

# Run tests
.\eng\testing\run-bruno.ps1 -Env local
```

#### Access Token Invalid or Expired

**Error:** Tests fail with 401/403

**Solution:** Token is automatically acquired fresh for each run. If persisting, clear and retry:

```powershell
# Clear cached token
$env:ACCESS_TOKEN = ''

# Run again (acquires new token)
.\eng\testing\run-bruno.ps1 -Env local
```

### Runner Script Options

```powershell
-Env <string>
    Environment: 'local' or 'ci'. Default: 'local'

-StartServices
    Start Docker Compose services before running tests.

-BootstrapAuth
    Bootstrap Keycloak: create client, user, acquire token.

-SeedData
    Seed test data (teams, memberships). If TEAM_ID is still missing for auth runs, seeding is triggered automatically.

-TeamId <int>
    Explicit TEAM_ID to pass to Bruno requests (for tests requiring team-scoped auth data).

-GrantType <string>
    OAuth grant: 'client_credentials' or 'password'. Default: 'client_credentials'

-Tag <string>
    Filter by tag: 'App' or 'Auth'. Default: all requests

-Request <string>
    Run single request by name (e.g., 'auth-me', 'app-healthcheck', or full prefixed names).

-Collection <string>
    Run requests in a collection/folder (e.g., 'collections/auth')
```

### Development

#### Adding New Tests

1. Create a new `.bru` file in `tests/api/`:
   ```
   meta {
     name: unique-name
     type: http
     seq: <number>
     tags: App   # or Auth
   }

   <METHOD> {
     url: {{BASE_URL}}/<endpoint>
   }

   tests {
     test("description", function() { ... });
   }
   ```

2. Run the test:
   ```powershell
   .\eng\testing\run-bruno.ps1 -Env local -Request unique-name
   ```

#### Modifying Bootstrap Logic

Edit `eng\helpers\bootstrap-keycloak-for-tests.ps1`:
- Keycloak client configuration (step 2)
- Test user creation (step 3)
- API team/membership seeding (step 4)

#### Environment Variables

Add new variables to:
- `tests/api/environments/local.bru` (local defaults)
- `tests/api/environments/ci.bru` (CI defaults)
- Runner script initialization (for computed values like `ACCESS_TOKEN`)

### Integration with CI/CD

See `.github/workflows/api-bruno-e2e.yml` for GitHub Actions workflow that:
1. Checks out code
2. Starts services with Docker Compose
3. Runs bootstrap and seed
4. Executes all tests by tag
5. Publishes test results

The workflow uses the same `run-bruno.ps1` script with `-Env ci`.

### References

- **Bruno CLI Docs:** https://docs.usebruno.com
- **Admin App API:** `/adminapp-api/api` (local URL)
- **Keycloak Admin:** `https://localhost/auth/` (admin / admin)
- **Architecture:** See `docs/design/2026-06-12-bruno-api-e2e-design.md`

## UI Playwright E2E Tests

Playwright + [playwright-bdd](https://github.com/vitalets/playwright-bdd)-driven end-to-end test suite for the Admin App frontend, run via `run-e2e-ui.ps1`. Unlike the Bruno suite, this runner also provisions the entire stack it tests against: it downloads the ODS Minimal Template backup, starts every Docker Compose service the Admin App needs (choosing PostgreSQL or SQL Server for the Admin App's own database), waits for the stack to become healthy, creates the local Keycloak test user, and then runs the suite.

### Prerequisites

The script self-checks these on every run and reports exactly what's missing (with the command to fix it) before doing anything else:

- **Docker & Docker Compose**, running locally
- **Node dependencies installed**: `npm ci --legacy-peer-deps`
- **Playwright Chromium browser installed**: `npx playwright install --with-deps chromium`
- **Local TLS certificate generated**: `bash ./compose/ssl/generate-certificate.sh`

### Quick Start

Run these commands from the repository root.

#### Run Against PostgreSQL (default)

```powershell
./eng/testing/run-e2e-ui.ps1
```

#### Run Against SQL Server

```powershell
./eng/testing/run-e2e-ui.ps1 -DbEngine mssql
```

#### Rebuild Images First

Rebuilds the Admin App images before starting services — useful after pulling in local code changes:

```powershell
./eng/testing/run-e2e-ui.ps1 -DbEngine mssql -Rebuild
```

#### Stop Services After the Run

By default the stack is left running after the suite finishes (pass or fail), so you can inspect it or re-run tests quickly. Add `-StopServices` to tear it down automatically (this is what CI uses):

```powershell
./eng/testing/run-e2e-ui.ps1 -DbEngine pgsql -Rebuild -StopServices
```

### What It Does

1. Checks prerequisites (Node dependencies, Playwright Chromium, TLS certificate).
2. Downloads the ODS Minimal Template backup into `compose/db-backup/` (skipped if already cached).
3. Regenerates `compose/.env` from `compose/.env.example` and, for `-DbEngine mssql`, patches `DB_ENGINE`, the `MSSQL_*` settings, and the active `DB_SECRET_VALUE` line.
4. Starts Docker Compose services (the `v6` and `odsV7-adminV2` topologies plus the Admin App) via `eng/helpers/start-services-target.ps1`.
5. Waits for the Admin App API, frontend, and Keycloak to be stable — and, for `-DbEngine mssql`, also waits for the Admin App's `sbaa` database to actually exist inside the SQL Server container.
6. Creates/updates the local Keycloak test user via `eng/helpers/create-local-user-keycloak.ps1`.
7. Runs `npm run test:e2e:bdd` (the Playwright BDD suite).
8. Optionally stops all Docker Compose services (`-StopServices`), then exits with the suite's own exit code.

### Runner Script Options

```powershell
-DbEngine <pgsql|mssql>
    Admin App database engine to provision and test against. Default: 'pgsql'.
    ODS/API databases always run on PostgreSQL regardless of this value — only
    the Admin App's own database engine changes.

-Rebuild
    Rebuild Admin App images before starting services.

-StopServices
    Stop Docker Compose services after the test run (success or failure).
```

### Notes

- **`compose/.env` is regenerated on every run.** The script overwrites it from `compose/.env.example` (patching it for MSSQL when needed), so any local customizations you've made to `compose/.env` (image tags, secrets, dataset choice) will be lost. A warning is printed when this happens.
- **ODS/API databases are unaffected by `-DbEngine`.** The `v6`, `odsV7-adminV2`, and `odsV7-adminV3` topologies always run on PostgreSQL; only the Admin App's own database switches between PostgreSQL and SQL Server.
- **CI runs this script against both engines.** `.github/workflows/run-e2e-ui.yml` uses a `db-engine: [pgsql, mssql]` matrix that calls `run-e2e-ui.ps1 -DbEngine <pgsql|mssql> -Rebuild -StopServices` once per engine.

### Troubleshooting

**Missing prerequisites** — the script prints exactly which one and the command to fix it; run that command and re-run the script.

**Timed out waiting for stable Admin App services** — the error message names which check(s) were still failing (`API`, `FE`, `KEYCLOAK_META`, `KEYCLOAK_LOGIN`, and for MSSQL, `MSSQL_SBAA_DB`). Check `docker ps` and `docker compose logs` for the corresponding container.

**SQL Server test flakiness** — some Playwright BDD test failures against `-DbEngine mssql` are a known, pre-existing app-level UI/timing issue under SQL Server, not caused by this runner script. A PostgreSQL run failing the same way is not expected and should be investigated as a real regression.

### References

- **Architecture:** See `docs/design/2026-08-03-mssql-e2e-ui-runner-design.md`
- **Playwright BDD:** https://github.com/vitalets/playwright-bdd
