# MSSQL-Capable Playwright E2E Runner

## Context

The Playwright BDD E2E suite (`tests/e2e`) currently only runs against PostgreSQL. The
steps needed to stand up the stack and run the suite are spread across
`.github/workflows/run-e2e-ui.yml` inline shell/pwsh blocks, with no local-dev
equivalent script (unlike the Bruno API E2E suite, which has
`eng/testing/run-bruno.ps1`).

This change:

- Adds a single reusable script, `eng/testing/run-e2e-ui.ps1`, that starts the stack
  (against PostgreSQL or SQL Server for the Admin App database) and runs the Playwright
  BDD suite, for both local devs and CI.
- Moves `eng/github-actions/start-services-target.ps1` to `eng/helpers/`, since it's a
  general-purpose service-startup helper, not something CI-specific.
- Updates `run-e2e-ui.yml` to call the new script and to run the suite against both
  database engines via a matrix.

## Out of scope

- The Bruno API E2E suite (`eng/testing/run-bruno.ps1`) is untouched.
- The ODS/API databases (v6, odsV7-adminV2, odsV7-adminV3 topologies) always run on
  PostgreSQL in this compose setup regardless of engine choice — only the Admin App's
  own database (`edfiadminapp-postgres` vs `edfiadminapp-mssql`) changes. The ODS
  Minimal Template backup download step is therefore unaffected by `-DbEngine`.
- `playwright.config.ts` needs no changes — `baseURL` is fixed
  (`https://localhost/adminapp`) regardless of the Admin App DB engine.

## 1. File moves

- Move `eng/github-actions/start-services-target.ps1` → `eng/helpers/start-services-target.ps1`.
  No internal logic changes are needed: its `$repoRoot` calculation
  (`Split-Path -Parent (Split-Path -Parent $PSScriptRoot)`) resolves to the same
  repository root from either location, since both are one level under `eng/`.
- Delete the `eng/github-actions/` folder (it only contained that script and its
  README). Fold the "What it does / How to run it / Common options" content from
  `eng/github-actions/README.md` into `eng/README.md`, under the `eng/helpers`
  section.
- Update references to the old path:
  - `.github/workflows/run-e2e-ui.yml` (calls the script directly)
  - `eng/README.md` (folder listing/links)

## 2. New script: `eng/testing/run-e2e-ui.ps1`

### Parameters

| Param | Type | Default | Purpose |
|---|---|---|---|
| `-DbEngine` | `pgsql` \| `mssql` | `pgsql` | Selects the Admin App database engine. Drives both the `.env` patch and the `-MSSQL` switch passed to `start-services-target.ps1`. |
| `-Rebuild` | switch | off | Passed through to `start-services-target.ps1` (rebuild Admin App images before starting). |
| `-StopServices` | switch | off | If set, stops Docker Compose services in a `finally` block after the test run (success or failure). If not set, the stack is left running, so local devs can inspect state or re-run tests without re-provisioning. |

### Steps

1. **Preflight checks** — fail fast with an actionable message rather than trying to
   auto-fix:
   - `node_modules` exists → else print `Run: npm ci --legacy-peer-deps` and exit 1.
   - Playwright's Chromium browser is installed (check the Playwright browsers cache
     path) → else print `Run: npx playwright install --with-deps chromium` and exit 1.
   - `compose/ssl/server.crt` exists → else print
     `Run: bash ./compose/ssl/generate-certificate.sh` and exit 1.

2. **Download ODS Minimal Template backup** — same logic as the current workflow step:
   downloads `EdFi.Suite3.Ods.Minimal.Template.PostgreSQL.Standard.4.0.0` from the
   Ed-Fi Azure DevOps feed, extracts the `.sql` file into `compose/db-backup/`, and
   copies it to both `EdFi.Ods.Minimal.Template.sql` and
   `EdFi.Ods.Populated.Template.sql`. If both target `.sql` files already exist in
   `compose/db-backup/`, skip the download and print a message noting the skip (keeps
   repeat local runs fast).

3. **Set up environment:**
   - Always regenerate `compose/.env` from `compose/.env.example` (rather than only
     copying if missing), so a prior run's engine-specific patch can't leak into the
     current run.
   - If `-DbEngine mssql`: patch the freshly copied `.env`:
     - Set `DB_ENGINE=mssql` (was `pgsql`).
     - Uncomment `MSSQL_PORT_EXPOSED`, `MSSQL_ACCEPT_EULA`, `MSSQL_IMAGE_TAG`.
     - Set `MSSQL_SA_PASSWORD` to a fixed strong local-only password (e.g.
       `YourStrong!Passw0rd`, matching SQL Server's complexity requirements).
     - Comment out the active (PostgreSQL) `DB_SECRET_VALUE` line and uncomment the
       MSSQL `DB_SECRET_VALUE` line, using the same password set above for
       `MSSQL_DB_PASSWORD`.
   - If `-DbEngine pgsql`: no patch needed — `.env.example` already defaults to
     PostgreSQL.
   - Call `eng/helpers/start-services-target.ps1 -V6 -OdsV7AdminV2 -IncludeAdminApp
     -Rebuild:$Rebuild -MSSQL:($DbEngine -eq 'mssql')`.
   - Wait-for-readiness loop (ported from the current workflow's stable-check loop):
     poll the Admin App API healthcheck, FE root, Keycloak OIDC metadata endpoint, and
     the Keycloak login page, requiring 3 consecutive successful checks before
     proceeding, with a bounded timeout.

4. **Create Local User Keycloak** — call `eng/helpers/create-local-user-keycloak.ps1`
   (unchanged).

5. **Run Playwright BDD E2E tests** — run `npm run test:e2e:bdd`; propagate its exit
   code as the script's own exit code.

6. If `-StopServices` was passed, run `compose/stop.ps1` in a `finally` block,
   regardless of whether step 5 passed or failed.

## 3. CI workflow (`run-e2e-ui.yml`) changes

- Add a matrix to the `playwright-e2e` job:
  ```yaml
  strategy:
    fail-fast: false
    matrix:
      db-engine: [pgsql, mssql]
  ```
  Both engines run in parallel, on every trigger (PR and `workflow_dispatch`) — each
  matrix entry gets its own isolated runner VM, so there's no `.env`/Docker network
  collision between the two parallel jobs.
- Keep the existing steps that satisfy the script's preflight checks as-is, before the
  new step: "Checkout code", "Setup Node", "Install dependencies", "Install Playwright
  browser dependencies", "Create local TLS certificate".
- Replace these steps with a single call to the new script:
  - "Download ODS Minimal Template backup"
  - "Start Docker Compose services"
  - "Wait for Admin App API and FE"
  - "Create Local User Keycloak"
  - "Run Playwright BDD E2E tests"
  - "Stop services"

  New step:
  ```yaml
  - name: Run E2E UI tests
    run: ./eng/testing/run-e2e-ui.ps1 -DbEngine ${{ matrix.db-engine }} -Rebuild -StopServices
  ```
- Append the engine to the uploaded artifact name so the two parallel jobs' results
  don't collide:
  ```yaml
  name: e2e-allure-results-${{ matrix.db-engine }}
  ```

## 4. Testing/validation plan

- Local dry run: `./eng/testing/run-e2e-ui.ps1 -DbEngine pgsql` — confirm no regression
  versus today's behavior.
- Local dry run: `./eng/testing/run-e2e-ui.ps1 -DbEngine mssql` — confirm the `.env`
  patch produces a working SQL Server-backed stack and the full suite passes.
- Trigger `run-e2e-ui.yml` via `workflow_dispatch` once merged, confirming both matrix
  jobs (`pgsql` and `mssql`) pass and upload distinctly named artifacts.

## 5. Future consideration: full MSSQL stack (ODS/API also on SQL Server)

Not part of this change, but noted for a possible follow-on effort: today the
ODS/API databases (`odsV7-*-db-ods`, built from `compose/DB-Ods`) are hardcoded to
PostgreSQL — restore uses `psql -f` against a `.sql` backup
(`compose/DB-Ods/init.sh`), and `edfi-services.yml` wires Postgres-only connection
strings, volumes, and healthchecks for every topology.

Ed-Fi also publishes a SQL Server variant of the ODS Minimal Template as a `.bak` file
(e.g.
`EdFi.Suite3.Ods.Minimal.Template.Standard.4.0.0` on the Ed-Fi Azure DevOps feed),
which would let the ODS/API itself run on SQL Server, not just the Admin App's own
database. Supporting that would require, roughly:

- A SQL-Server-backed variant of the ODS container (new image/Dockerfile alongside
  `compose/DB-Ods`, or a conditional entrypoint), restoring via `RESTORE DATABASE ...
  FROM DISK` instead of `psql -f`.
- New `edfi-services.yml` service definitions (or profile-gated variants of the
  existing ones) with SQL Server connection strings, ports, and healthchecks for each
  topology (v6, odsV7-adminV2, odsV7-adminV3).
- A download step for the `.bak` backup, parallel to today's `.sql` download, selected
  by whichever engine flag ends up driving ODS DB choice.
- Deciding whether ODS engine and Admin App DB engine are selected independently (two
  flags) or always move together under one `-DbEngine` value — independent selection
  is likely more valuable since it mirrors real deployment flexibility, but roughly
  doubles the CI matrix if both dimensions are tested.

This would warrant its own design/spec pass rather than folding into the current
change.
