import { MigrationInterface, QueryRunner } from 'typeorm';
import { hasPgbossArchive } from './pgboss-compat';

export class EnvNav1710178189458 implements MigrationInterface {
  name = 'EnvNav1710178189458';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
      ['MATERIALIZED_VIEW', 'sb_sync_queue', 'public']
    );
    await queryRunner.query(`DROP MATERIALIZED VIEW "sb_sync_queue"`);

    const archiveExists = await hasPgbossArchive(queryRunner);

    if (archiveExists) {
      // Legacy branch: pg-boss ≤v9 camelCase schema with pgboss.archive table
      await queryRunner.query(`CREATE MATERIALIZED VIEW "sb_sync_queue" AS with job as (select id, name, data, state, createdon, completedon, output
    from pgboss.job
    where name in ('sbe-sync', 'edfi-tenant-sync')
    union
    select id, name, data, state, createdon, completedon, output
    from pgboss.archive
    where name in ('sbe-sync', 'edfi-tenant-sync'))
select job."id",
case when job."name" = 'sbe-sync' then 'SbEnvironment' else 'EdfiTenant' end     "type",
coalesce(sb_environment."name", edfi_tenant."name", 'resource no longer exists') "name",
coalesce(sb_environment."id", edfi_tenant."sbEnvironmentId")                     "sbEnvironmentId",
edfi_tenant."id"                                                                 "edfiTenantId",
"data"::text                                                                     "dataText",
data,
state,
createdon,
completedon,
output,
(job.output -> 'hasChanges')::bool                                               "hasChanges"
from job
left join public.sb_environment on (job.data -> 'sbEnvironmentId')::int = sb_environment.id
left join public.edfi_tenant on (job.data -> 'edfiTenantId')::int = edfi_tenant.id`);
      await queryRunner.query(
        `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
        [
          'public',
          'MATERIALIZED_VIEW',
          'sb_sync_queue',
          'with job as (select id, name, data, state, createdon, completedon, output\n    from pgboss.job\n    where name in (\'sbe-sync\', \'edfi-tenant-sync\')\n    union\n    select id, name, data, state, createdon, completedon, output\n    from pgboss.archive\n    where name in (\'sbe-sync\', \'edfi-tenant-sync\'))\nselect job."id",\ncase when job."name" = \'sbe-sync\' then \'SbEnvironment\' else \'EdfiTenant\' end     "type",\ncoalesce(sb_environment."name", edfi_tenant."name", \'resource no longer exists\') "name",\ncoalesce(sb_environment."id", edfi_tenant."sbEnvironmentId")                     "sbEnvironmentId",\nedfi_tenant."id"                                                                 "edfiTenantId",\n"data"::text                                                                     "dataText",\ndata,\nstate,\ncreatedon,\ncompletedon,\noutput,\n(job.output -> \'hasChanges\')::bool                                               "hasChanges"\nfrom job\nleft join public.sb_environment on (job.data -> \'sbEnvironmentId\')::int = sb_environment.id\nleft join public.edfi_tenant on (job.data -> \'edfiTenantId\')::int = edfi_tenant.id',
        ]
      );
    } else {
      // v12 branch: pg-boss v10+ snake_case schema — pgboss.archive no longer exists
      await queryRunner.query(`CREATE MATERIALIZED VIEW "sb_sync_queue" AS with job as (select id, name, data, state, created_on as createdon, completed_on as completedon, output
    from pgboss.job
    where name in ('sbe-sync', 'edfi-tenant-sync'))
select job."id",
case when job."name" = 'sbe-sync' then 'SbEnvironment' else 'EdfiTenant' end     "type",
coalesce(sb_environment."name", edfi_tenant."name", 'resource no longer exists') "name",
coalesce(sb_environment."id", edfi_tenant."sbEnvironmentId")                     "sbEnvironmentId",
edfi_tenant."id"                                                                 "edfiTenantId",
"data"::text                                                                     "dataText",
data,
state,
createdon,
completedon,
output,
(job.output -> 'hasChanges')::bool                                               "hasChanges"
from job
left join public.sb_environment on (job.data -> 'sbEnvironmentId')::int = sb_environment.id
left join public.edfi_tenant on (job.data -> 'edfiTenantId')::int = edfi_tenant.id`);
      await queryRunner.query(
        `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
        [
          'public',
          'MATERIALIZED_VIEW',
          'sb_sync_queue',
          'with job as (select id, name, data, state, created_on as createdon, completed_on as completedon, output\n    from pgboss.job\n    where name in (\'sbe-sync\', \'edfi-tenant-sync\'))\nselect job."id",\ncase when job."name" = \'sbe-sync\' then \'SbEnvironment\' else \'EdfiTenant\' end     "type",\ncoalesce(sb_environment."name", edfi_tenant."name", \'resource no longer exists\') "name",\ncoalesce(sb_environment."id", edfi_tenant."sbEnvironmentId")                     "sbEnvironmentId",\nedfi_tenant."id"                                                                 "edfiTenantId",\n"data"::text                                                                     "dataText",\ndata,\nstate,\ncreatedon,\ncompletedon,\noutput,\n(job.output -> \'hasChanges\')::bool                                               "hasChanges"\nfrom job\nleft join public.sb_environment on (job.data -> \'sbEnvironmentId\')::int = sb_environment.id\nleft join public.edfi_tenant on (job.data -> \'edfiTenantId\')::int = edfi_tenant.id',
        ]
      );
    }

    await queryRunner.query(`CREATE VIEW "env_nav" AS 
  select "name" "sbEnvironmentName", "id" "sbEnvironmentId", null "edfiTenantName", null "edfiTenantId"
from sb_environment
union
select sb_environment."name",
       sb_environment."id",
       edfi_tenant."name",
       edfi_tenant."id"
from sb_environment
         right join edfi_tenant on sb_environment.id = edfi_tenant."sbEnvironmentId";`);
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
      [
        'public',
        'VIEW',
        'env_nav',
        'select "name" "sbEnvironmentName", "id" "sbEnvironmentId", null "edfiTenantName", null "edfiTenantId"\nfrom sb_environment\nunion\nselect sb_environment."name",\n       sb_environment."id",\n       edfi_tenant."name",\n       edfi_tenant."id"\nfrom sb_environment\n         right join edfi_tenant on sb_environment.id = edfi_tenant."sbEnvironmentId";',
      ]
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
      ['VIEW', 'env_nav', 'public']
    );
    await queryRunner.query(`DROP VIEW "env_nav"`);
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
      ['MATERIALIZED_VIEW', 'sb_sync_queue', 'public']
    );
    await queryRunner.query(`DROP MATERIALIZED VIEW "sb_sync_queue"`);

    const archiveExists = await hasPgbossArchive(queryRunner);

    if (archiveExists) {
      // Legacy branch: pg-boss ≤v9 camelCase schema with pgboss.archive table
      await queryRunner.query(`CREATE MATERIALIZED VIEW "sb_sync_queue" AS with job as (select id, name, data, state, createdon, completedon, output
    from pgboss.job
    where name in ('sbe-sync', 'edfi-tenant-sync')
    union
    select id, name, data, state, createdon, completedon, output
    from pgboss.archive
    where name in ('sbe-sync', 'edfi-tenant-sync'))
select job."id",
case when job."name" = 'sbe-sync' then 'SbEnvironment' else 'EdfiTenant' end     "type",
coalesce(sb_environment."name", edfi_tenant."name", 'resource no longer exists') "name",
coalesce(sb_environment."id", edfi_tenant."sbEnvironmentId")                     "sbEnvironmentId",
edfi_tenant."id"                                                                 "edfiTenantId",
"data"::text                                                                     "dataText",
data,
state,
createdon,
completedon,
output,
(job.output -> 'hasChanges')::bool                                               "hasChanges"
from job
left join public.sb_environment on (job.data -> 'sbEnvironmentId')::int = sb_environment.id
left join public.edfi_tenant on (job.data -> 'edfiTenantId')::int = edfi_tenant.id`);
      await queryRunner.query(
        `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
        [
          'public',
          'MATERIALIZED_VIEW',
          'sb_sync_queue',
          "with job as (select id, name, data, state, createdon, completedon, output\n    from pgboss.job\n    where name in ('sbe-sync', 'edfi-tenant-sync')\n    union\n    select id, name, data, state, createdon, completedon, output\n    from pgboss.archive\n    where name in ('sbe-sync', 'edfi-tenant-sync'))\nselect job.\"id\",\ncase when job.\"name\" = 'sbe-sync' then 'SbEnvironment' else 'EdfiTenant' end     \"type\",\ncoalesce(sb_environment.\"name\", edfi_tenant.\"name\", 'resource no longer exists') \"name\",\ncoalesce(sb_environment.\"id\", edfi_tenant.\"sbEnvironmentId\")                     \"sbEnvironmentId\",\nedfi_tenant.\"id\"                                                                 \"edfiTenantId\",\n\"data\"::text                                                                     \"dataText\",\ndata,\nstate,\ncreatedon,\ncompletedon,\noutput,\n(job.output -> 'hasChanges')::bool                                               \"hasChanges\"\nfrom job\nleft join public.sb_environment on (job.data -> 'sbEnvironmentId')::int = sb_environment.id\nleft join public.edfi_tenant on (job.data -> 'edfiTenantId')::int = edfi_tenant.id",
        ]
      );
    } else {
      // v12 branch: pg-boss v10+ snake_case schema — pgboss.archive no longer exists
      await queryRunner.query(`CREATE MATERIALIZED VIEW "sb_sync_queue" AS with job as (select id, name, data, state, created_on as createdon, completed_on as completedon, output
    from pgboss.job
    where name in ('sbe-sync', 'edfi-tenant-sync'))
select job."id",
case when job."name" = 'sbe-sync' then 'SbEnvironment' else 'EdfiTenant' end     "type",
coalesce(sb_environment."name", edfi_tenant."name", 'resource no longer exists') "name",
coalesce(sb_environment."id", edfi_tenant."sbEnvironmentId")                     "sbEnvironmentId",
edfi_tenant."id"                                                                 "edfiTenantId",
"data"::text                                                                     "dataText",
data,
state,
createdon,
completedon,
output,
(job.output -> 'hasChanges')::bool                                               "hasChanges"
from job
left join public.sb_environment on (job.data -> 'sbEnvironmentId')::int = sb_environment.id
left join public.edfi_tenant on (job.data -> 'edfiTenantId')::int = edfi_tenant.id`);
      await queryRunner.query(
        `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
        [
          'public',
          'MATERIALIZED_VIEW',
          'sb_sync_queue',
          "with job as (select id, name, data, state, created_on as createdon, completed_on as completedon, output\n    from pgboss.job\n    where name in ('sbe-sync', 'edfi-tenant-sync'))\nselect job.\"id\",\ncase when job.\"name\" = 'sbe-sync' then 'SbEnvironment' else 'EdfiTenant' end     \"type\",\ncoalesce(sb_environment.\"name\", edfi_tenant.\"name\", 'resource no longer exists') \"name\",\ncoalesce(sb_environment.\"id\", edfi_tenant.\"sbEnvironmentId\")                     \"sbEnvironmentId\",\nedfi_tenant.\"id\"                                                                 \"edfiTenantId\",\n\"data\"::text                                                                     \"dataText\",\ndata,\nstate,\ncreatedon,\ncompletedon,\noutput,\n(job.output -> 'hasChanges')::bool                                               \"hasChanges\"\nfrom job\nleft join public.sb_environment on (job.data -> 'sbEnvironmentId')::int = sb_environment.id\nleft join public.edfi_tenant on (job.data -> 'edfiTenantId')::int = edfi_tenant.id",
        ]
      );
    }
  }
}
