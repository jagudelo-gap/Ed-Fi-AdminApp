# Custom ODS DB Container (AC-572)

## Summary

Replaced the Docker Hub `edfialliance/${ODS_DB_IMAGE_7X}:${ODS_DB_TAG_7X}` image
with a locally-built PostgreSQL image (`compose\DB-Ods\Dockerfile` +
`compose\DB-Ods\init.sh`) for the ODS database containers in
`compose\edfi-services.yml`, based on the reference files in `docs\AC-572`.

The custom image restores ODS data from user-supplied `.sql` backup files on
first run: it creates `Ods_Minimal_Template` and `Ods_Populated_Template`
(each restored once and marked as Postgres template databases), then creates
the real `EdFi_Ods` database as a fast filesystem-level clone
(`CREATE DATABASE ... TEMPLATE ...`) of whichever template the `EDFI_ODS_DATASET`
env var selects (`minimal` | `populated`, default `minimal`).

## Scope

Applied to all `v7.x` ODS DB containers except v6 (out of scope):

- `odsV7-adminV2-single-db-ods` (+ `odsV7-adminV2-single-adminapi` connection strings)
- `odsV7-adminV2-tenant1-db-ods` / `odsV7-adminV2-tenant2-db-ods`
- `odsV7-adminV3-single-db-ods` (+ `odsV7-adminV3-single-adminapi` connection strings)
- `odsV7-adminV3-tenant1-db-ods` / `odsV7-adminV3-tenant2-db-ods`

All topologies share the same env vars and backup files
(`SQL_BACKUPS_FOLDER`, `MINIMAL_SQL_PATH`, `POPULATED_SQL_PATH`,
`EDFI_ODS_DATASET`, `POSTGRES_PORT`).

## Key changes

- **`compose\DB-Ods\Dockerfile` / `init.sh`**: new custom Postgres 16 image.
- **`compose\edfi-services.yml`**: each `*-db-ods` service switched from
  `image:` to `build: context: ./DB-Ods` + explicit `image: edfiadminapp/db-ods:local`,
  with the new env vars and a read-only bind mount:
  `${SQL_BACKUPS_FOLDER}:/var/opt/pgsql/data/sql-backups/:ro`.
- **Single-tenant adminapi containers** (v2 and v3): added
  `ConnectionStrings__EdFi_Ods` / `ConnectionStrings__EdFi_Master`
  (`password=${POSTGRES_PASSWORD}` — not the pre-existing `******` literal
  bug present in some older `EdFi_Admin`/`EdFi_Security` lines, which were
  intentionally left untouched) and added the db-ods container to `depends_on`.
- **Multi-tenant adminapi containers** (v2 and v3) get their connection
  strings from `compose\settings\appsettings.v2.dockertemplate.json` /
  `appsettings.v3.dockertemplate.json` via `envsubst`; added `EdFi_Ods` /
  `EdFi_Master` entries per tenant, plus db-ods entries in `depends_on`.
- **`.env.example` / `.env`**: added `SQL_BACKUPS_FOLDER`, `MINIMAL_SQL_PATH`,
  `POPULATED_SQL_PATH`, `EDFI_ODS_DATASET`, `POSTGRES_PORT`.
- **`.gitignore`**: added `db-backup/*.sql` (users provide their own backup
  files locally in `compose\db-backup\`; not committed).

## Status

Single-tenant v2 tested and confirmed working by the user. Multi-tenant v2,
single-tenant v3, and multi-tenant v3 implemented, `docker compose config`
validated; pending user testing. Documentation updates to
`compose\readme.md`, `docs\ed-fi-development.md`, and `docs\deployment.md`
are still outstanding.

## Related commits

- `34e1188` — Dockerfile + init.sh
- `104dab4` — env vars
- `bc686d6` — single-tenant v2 db-ods build config
- `67932f7` / `d0f66e8` — single-tenant v2 adminapi connection strings + password fix
- `9f7008a` — multi-tenant v2, single-tenant v3, multi-tenant v3 expansion
