# Engineering Scripts

This folder contains local engineering and test automation scripts used by Admin App contributors.

## Folder Contents

### `eng\helpers`

- `bootstrap-keycloak-for-tests.ps1` — Bootstraps Keycloak clients/users and can seed test data used by API test flows.
- `create-local-user-keycloak.ps1` — Creates/updates a local Keycloak user for development scenarios.
- `start-all-services-test-docker.ps1` — Starts local Docker services required for API test runs.
- `get-bruno-token.ps1` — Requests an OAuth token from Keycloak container.
- `start-services-target.ps1` — Starts the Docker Compose services required for Admin App development and E2E execution. Selects one or more Ed-Fi target topologies (`v6`, `odsV7-adminV2`, `odsV7-adminV3`), optionally includes Admin App containers, and can rebuild images before startup. Supports `-MSSQL` to use SQL Server instead of PostgreSQL for the Admin App database.

  ```powershell
  pwsh ./eng/helpers/start-services-target.ps1 -V6 -OdsV7AdminV2 -IncludeAdminApp -Rebuild
  ```

  Requirements: Docker must be installed and running; `compose/.env` must exist before the script runs; run it from a clone of the repository so relative paths resolve correctly.

- `check-ignored-vuln-fixes.ps1` — Reports whether any GHSA ID ignored in `osv-scanner.toml` (the `[[IgnoredVulns]]` entries that suppress OpenSSF Scorecard's "Vulnerabilities" check) now has an upstream fix. Reads the GHSA IDs straight out of `osv-scanner.toml`, resolves each affected package's version(s) from `package-lock.json`, and checks a patched version is reachable (the latest published npm CLI release for packages bundled inside npm itself, or the latest registry release otherwise) before comparing against the GitHub Security Advisories API. Prints a status table and exits non-zero if any entry can now be removed. Read-only — never modifies `osv-scanner.toml`, `package.json`, or `package-lock.json`. Also runs as an informational (non-blocking) step in `.github/workflows/scorecard.yml`.

  ```powershell
  pwsh ./eng/helpers/check-ignored-vuln-fixes.ps1
  ```

  Requirements: `npm` on PATH (queries the registry and unpacks the `npm` CLI package to inspect its bundled dependencies); network access to the npm registry and `api.github.com`. Optionally pass `-GitHubToken` (or set `$env:GITHUB_TOKEN`/`$env:GH_TOKEN`) to raise the unauthenticated GitHub API rate limit.

### `eng\testing`

- `run-bruno.ps1` — Main runner for Bruno API tests, including optional service startup, auth bootstrap, token acquisition, and collection/request filters.
- `run-e2e-ui.ps1` — Main runner for the Playwright BDD UI E2E suite. Checks prerequisites (Node dependencies, Playwright Chromium, TLS certificate), downloads the ODS Minimal Template backup (cached after the first run), regenerates `compose/.env` (patching it for SQL Server when `-DbEngine mssql` is used), starts Docker Compose services via `start-services-target.ps1`, waits for the Admin App API/frontend/Keycloak (and, for MSSQL, the Admin App database) to be ready, creates the local Keycloak test user, and runs `npm run test:e2e:bdd`. Supports `-DbEngine <pgsql|mssql>` to choose the Admin App's database engine (default `pgsql`; ODS/API databases always stay on PostgreSQL), `-Rebuild` to rebuild images first, and `-StopServices` to tear down the stack after the run. Note: this script regenerates `compose/.env` from `compose/.env.example` on every run, overwriting any local customizations you may have made to `compose/.env`.

  ```powershell
  pwsh ./eng/testing/run-e2e-ui.ps1 -DbEngine mssql -Rebuild -StopServices
  ```

For full usage, flags, and troubleshooting:
- `run-bruno.ps1` — see [API Bruno E2E Tests](testing/README.md#api-bruno-e2e-tests)
- `run-e2e-ui.ps1` — see [UI Playwright E2E Tests](testing/README.md#ui-playwright-e2e-tests)
