import { MigrationInterface, QueryRunner } from 'typeorm';
import { hasPgbossArchive } from './pgboss-compat';

export class V7Changes1709328882890 implements MigrationInterface {
  name = 'V7Changes1709328882890';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // internalize privileges
    await queryRunner.query(
      `ALTER TABLE "role" ADD "privilegeIds" text array NOT NULL DEFAULT '{}'`
    );

    await queryRunner.query(`
        UPDATE "role"
        SET "privilegeIds" = (
          SELECT ARRAY_AGG("privilegeCode")
          FROM "role_privileges_privilege"
          WHERE "role_privileges_privilege"."roleId" = "role"."id"
        )`);

    await queryRunner.query(`DROP TABLE "role_privileges_privilege"`);
    await queryRunner.query(`DROP TABLE "privilege"`);
    // rename tenant
    await queryRunner.query(`ALTER TABLE "role" RENAME COLUMN "tenantId" TO "teamId"`);
    await queryRunner.query(`ALTER TABLE "ownership" RENAME COLUMN "tenantId" TO "teamId"`);
    await queryRunner.query(`ALTER TABLE "tenant" RENAME TO "team"`);
    await queryRunner.query(
      `ALTER TABLE "user_tenant_membership" RENAME TO "user_team_membership"`
    );
    await queryRunner.query(`ALTER SEQUENCE "tenant_id_seq" RENAME TO "team_id_seq"`);
    await queryRunner.query(
      `ALTER SEQUENCE "user_tenant_membership_id_seq" RENAME TO "user_team_membership_id_seq"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_team_membership" RENAME COLUMN "tenantId" TO "teamId"`
    );
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION array_replace(arr text[], search text, replace text)
      RETURNS text[] AS $$
      DECLARE
          result text[] := '{}';
          item text;
      BEGIN
          FOREACH item IN ARRAY arr LOOP
              result := array_append(result, replace(item, search, replace));
          END LOOP;
          RETURN result;
      END;
      $$ LANGUAGE plpgsql IMMUTABLE;`);

    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_replace("privilegeIds", 'tenant', 'team')`
    );
    await queryRunner.query(`UPDATE role SET "type" = '"UserTeam"' WHERE "type" = '"UserTenant"'`);

    // rename constraints (they're hashes of templated strings like sequence names above, and typeorm relies on that)
    await queryRunner.query(`ALTER TABLE "team" DROP CONSTRAINT "FK_1636cc00622963d7c7a5499312c"`);
    await queryRunner.query(`ALTER TABLE "team" DROP CONSTRAINT "FK_372fed256480b89aafbfb2f9e8b"`);
    await queryRunner.query(
      `ALTER TABLE "user_team_membership" DROP CONSTRAINT "FK_37a8b3d9ab253bcc6651a290013"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_team_membership" DROP CONSTRAINT "FK_49e594e22dbe4c5e78689dbcb5e"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_team_membership" DROP CONSTRAINT "FK_559208b256dbd6a371f121333e5"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_team_membership" DROP CONSTRAINT "FK_825eb5ca32b71e4db155dc1b7c9"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_team_membership" DROP CONSTRAINT "FK_c5b276250571c341867e2b7ca1c"`
    );
    await queryRunner.query(`ALTER TABLE "role" DROP CONSTRAINT "FK_1751a572e91385a09d41c624714"`);
    await queryRunner.query(
      `ALTER TABLE "ownership" DROP CONSTRAINT "FK_1d4587643a7ce7fa5727816d7cc"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_team_membership" DROP CONSTRAINT "UQ_9f362212436320884321873e1fd"`
    );
    await queryRunner.query(
      `ALTER TABLE "ownership" DROP CONSTRAINT "UQ_03fd4f242cf59f808f69df949a1"`
    );
    await queryRunner.query(
      `ALTER TABLE "ownership" DROP CONSTRAINT "UQ_4f9d354f38493a53dd7b1a1b96e"`
    );
    await queryRunner.query(
      `ALTER TABLE "ownership" DROP CONSTRAINT "UQ_e81f6591816838e021ba3a4e110"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_team_membership" ADD CONSTRAINT "UQ_fd1dcfae7e73c3d52a4b2d9df5e" UNIQUE ("teamId", "userId")`
    );
    await queryRunner.query(
      `ALTER TABLE "ownership" ADD CONSTRAINT "UQ_dd40433e091e5d45bec9b801d28" UNIQUE ("teamId", "edorgId")`
    );
    await queryRunner.query(
      `ALTER TABLE "ownership" ADD CONSTRAINT "UQ_dc1f1ddb60cb2358f424909bf7c" UNIQUE ("teamId", "odsId")`
    );
    await queryRunner.query(
      `ALTER TABLE "ownership" ADD CONSTRAINT "UQ_6963c608cdaa6f203b20eb938ed" UNIQUE ("teamId", "sbeId")`
    );
    await queryRunner.query(
      `ALTER TABLE "team" ADD CONSTRAINT "FK_3a93fbdeba4e1e9e47fec6bada9" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "team" ADD CONSTRAINT "FK_4a6172bf2bf88b295a19b3245a7" FOREIGN KEY ("modifiedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "user_team_membership" ADD CONSTRAINT "FK_2454184e9011e28172f06d0d639" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "user_team_membership" ADD CONSTRAINT "FK_978dfce88e15d0e7461b7350b1e" FOREIGN KEY ("modifiedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "user_team_membership" ADD CONSTRAINT "FK_e08e451152e4e3214301716d149" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "user_team_membership" ADD CONSTRAINT "FK_513e407d9457dc50784b4d9c20d" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "user_team_membership" ADD CONSTRAINT "FK_ac0aaa143bbf1ee8725a6b1593e" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "role" ADD CONSTRAINT "FK_997dd31f342ad1e67a8dc9a24d1" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "ownership" ADD CONSTRAINT "FK_9ed3cde4307ca1cf1275e297152" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    // rename sbe
    await queryRunner.query(`ALTER TABLE "ods" DROP CONSTRAINT "FK_829131f86e2d025918e2dee5a40"`);
    await queryRunner.query(`ALTER TABLE "edorg" DROP CONSTRAINT "FK_4f7237384382e4796332a25ea48"`);
    await queryRunner.query(
      `ALTER TABLE "ownership" DROP CONSTRAINT "FK_dcde9ae7d31fa30b2623697ff28"`
    );
    await queryRunner.query(`ALTER TABLE "edorg" DROP CONSTRAINT "UQ_07c5479767d3c27eb0150fee1d9"`);
    await queryRunner.query(
      `ALTER TABLE "ownership" DROP CONSTRAINT "UQ_6963c608cdaa6f203b20eb938ed"`
    );

    await queryRunner.query(`ALTER TABLE "sbe" RENAME TO "edfi_tenant"`);
    await queryRunner.query(`ALTER SEQUENCE "sbe_id_seq" RENAME TO "edfi_tenant_id_seq"`);

    await queryRunner.query(`ALTER TABLE "ods" RENAME COLUMN "sbeId" TO "edfiTenantId"`);
    await queryRunner.query(`ALTER TABLE "edorg" RENAME COLUMN "sbeId" TO "edfiTenantId"`);
    await queryRunner.query(`ALTER TABLE "ownership" RENAME COLUMN "sbeId" TO "edfiTenantId"`);

    await queryRunner.query(
      `ALTER TABLE "edorg" ADD CONSTRAINT "UQ_33c75697e30842d2559e910ffef" UNIQUE ("edfiTenantId", "odsId", "educationOrganizationId")`
    );
    await queryRunner.query(
      `ALTER TABLE "ownership" ADD CONSTRAINT "UQ_0796c30d643a13b0a5489e1f7c3" UNIQUE ("teamId", "edfiTenantId")`
    );
    await queryRunner.query(
      `ALTER TABLE "ods" ADD CONSTRAINT "FK_21f00024e194f67e9f51575f750" FOREIGN KEY ("edfiTenantId") REFERENCES "edfi_tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "edorg" ADD CONSTRAINT "FK_bce5c212f9dd8360f0bf8168ac9" FOREIGN KEY ("edfiTenantId") REFERENCES "edfi_tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "ownership" ADD CONSTRAINT "FK_ce537e2505b0775277cf7e4a83d" FOREIGN KEY ("edfiTenantId") REFERENCES "edfi_tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );

    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_replace("privilegeIds", 'sbe', 'edfi-tenant')`
    );
    // add sb environment
    await queryRunner.query(
      `ALTER TABLE "edfi_tenant" DROP CONSTRAINT "FK_8f912321b2a5d074197d2169f72"`
    );
    await queryRunner.query(
      `ALTER TABLE "edfi_tenant" DROP CONSTRAINT "FK_ce4b1775b7e60418caa2df331a2"`
    );
    await queryRunner.query(
      `CREATE TABLE "sb_environment" ("id" SERIAL NOT NULL, "created" TIMESTAMP NOT NULL DEFAULT now(), "modified" TIMESTAMP NOT NULL DEFAULT now(), "createdById" integer, "modifiedById" integer, "envLabel" character varying, "name" character varying NOT NULL, "configPublic" jsonb, "configPrivate" jsonb, CONSTRAINT "PK_9f51231184c890eb1d5b9d01758" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `INSERT INTO "sb_environment" (
        "id", "name", "created", "modified", "createdById", "modifiedById", "envLabel", "configPublic", "configPrivate"
        ) SELECT
        "id", "name", "created", "modified", "createdById", "modifiedById", "envLabel", "configPublic", "configPrivate" FROM "edfi_tenant"`
    );
    await queryRunner.query(
      `SELECT setval('sb_environment_id_seq', (SELECT MAX("id") FROM "sb_environment"))`
    );
    await queryRunner.query(`ALTER TABLE "edfi_tenant" ADD "sbEnvironmentId" integer`);
    await queryRunner.query(`UPDATE "edfi_tenant" SET "sbEnvironmentId" = "id"`);
    await queryRunner.query(
      `ALTER TABLE "edfi_tenant" ALTER COLUMN "sbEnvironmentId" SET NOT NULL`
    );
    await queryRunner.query(`UPDATE "edfi_tenant" SET "name" = 'default'`);
    await queryRunner.query(`ALTER TABLE "edfi_tenant" DROP COLUMN "envLabel"`);
    await queryRunner.query(`ALTER TABLE "edfi_tenant" DROP COLUMN "configPrivate"`);
    await queryRunner.query(`ALTER TABLE "edfi_tenant" DROP COLUMN "configPublic"`);
    await queryRunner.query(`ALTER TABLE "ownership" ADD "sbEnvironmentId" integer`);
    await queryRunner.query(`ALTER TABLE "edorg" DROP CONSTRAINT "FK_bce5c212f9dd8360f0bf8168ac9"`);
    await queryRunner.query(
      `ALTER TABLE "ownership" DROP CONSTRAINT "FK_ce537e2505b0775277cf7e4a83d"`
    );
    await queryRunner.query(`ALTER TABLE "ods" DROP CONSTRAINT "FK_21f00024e194f67e9f51575f750"`);
    await queryRunner.query(
      `COMMENT ON COLUMN "edfi_tenant"."name" IS 'The name used in the tenant management database in StartingBlocks'`
    );
    await queryRunner.query(
      `ALTER TABLE "ods" ADD CONSTRAINT "FK_21f00024e194f67e9f51575f750" FOREIGN KEY ("edfiTenantId") REFERENCES "edfi_tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "edfi_tenant" ADD CONSTRAINT "FK_77c6bec8378354712fac1f4ed9e" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "edfi_tenant" ADD CONSTRAINT "FK_e1ebbdef1ca79a15f84673c8c04" FOREIGN KEY ("modifiedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "edfi_tenant" ADD CONSTRAINT "FK_becbb52581423083ffcf053733a" FOREIGN KEY ("sbEnvironmentId") REFERENCES "sb_environment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "edorg" ADD CONSTRAINT "FK_bce5c212f9dd8360f0bf8168ac9" FOREIGN KEY ("edfiTenantId") REFERENCES "edfi_tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "ownership" ADD CONSTRAINT "FK_fe36fa53d8f494740a5af704430" FOREIGN KEY ("sbEnvironmentId") REFERENCES "sb_environment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "ownership" ADD CONSTRAINT "FK_ce537e2505b0775277cf7e4a83d" FOREIGN KEY ("edfiTenantId") REFERENCES "edfi_tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "sb_environment" ADD CONSTRAINT "FK_9689609f9a1151c15e0fd46044e" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "sb_environment" ADD CONSTRAINT "FK_d31c6bd5a79862649f2407ff3ac" FOREIGN KEY ("modifiedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );
    // migrate privileges
    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_replace("privilegeIds", 'edfi-tenant', 'sb-environment.edfi-tenant')`
    );
    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_replace("privilegeIds", 'edfi-tenant.edorg', 'edfi-tenant.ods.edorg')`
    );
    await queryRunner.query(
      `DO $$
      DECLARE
          r record;
      BEGIN
          FOR r IN SELECT id, "privilegeIds" FROM "role"
          LOOP
              -- Check if the array contains any item with ".edfi-tenant:"
              IF EXISTS (SELECT 1 FROM unnest(r."privilegeIds") as unnested_privilege WHERE unnested_privilege LIKE '%.edfi-tenant:%') THEN
                  -- Generate new items by replacing ".edfi-tenant:" with ":" and concatenate with the original array
                  UPDATE "role"
                  SET "privilegeIds" = array_cat( r."privilegeIds",
                                                  ARRAY(SELECT replace(unnested_privilege, '.edfi-tenant:', ':')
                                                        FROM unnest(r."privilegeIds") as unnested_privilege
                                                        WHERE unnested_privilege LIKE '%.edfi-tenant:%'))
                  WHERE id = r.id;
              END IF;
          END LOOP;
      END $$;
      `
    );
    // denormalize sbEnvironmentId
    await queryRunner.query(`ALTER TABLE "ods" ADD "sbEnvironmentId" integer`);
    await queryRunner.query(`ALTER TABLE "edorg" ADD "sbEnvironmentId" integer`);

    await queryRunner.query(
      `UPDATE "ods" SET "sbEnvironmentId" = "edfi_tenant"."sbEnvironmentId" FROM "edfi_tenant" WHERE "ods"."edfiTenantId" = "edfi_tenant"."id"`
    );
    await queryRunner.query(
      `UPDATE "edorg" SET "sbEnvironmentId" = "edfi_tenant"."sbEnvironmentId" FROM "edfi_tenant" WHERE "edorg"."edfiTenantId" = "edfi_tenant"."id"`
    );

    await queryRunner.query(`ALTER TABLE "ods" ALTER COLUMN "sbEnvironmentId" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "edorg" ALTER COLUMN "sbEnvironmentId" SET NOT NULL`);

    await queryRunner.query(`ALTER TABLE "ods" ADD "odsInstanceId" integer`);
    await queryRunner.query(`ALTER TABLE "edorg" ADD "odsInstanceId" integer`);
    await queryRunner.query(
      `COMMENT ON COLUMN "edfi_tenant"."name" IS 'The name used in the tenant management database in StartingBlocks, or "default" for v5/6 environments'`
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "edorg"."educationOrganizationId" IS 'Pre-v7/v2, this reliably included the Ods name. In v7/v2 it is no longer alone sufficient as a natural key, and must be combined with an ODS identifier.'`
    );
    // migrate sbe config
    await queryRunner.query(
      `UPDATE "sb_environment"
      SET "configPublic" = jsonb_build_object(
        'sbEnvironmentMetaArn', "configPublic"->'sbeMetaArn',
        'adminApiUrl', "configPublic"->'adminApiUrl',
        'version', 'v1',
        'values', jsonb_build_object(
          'adminApiKey', "configPublic"->'adminApiKey',
          'adminApiUrl', "configPublic"->'adminApiUrl',
          'edfiHostname', "configPublic"->'edfiHostname',
          'adminApiClientDisplayName', "configPublic"->'adminApiClientDisplayName'
        )
      )
      WHERE "configPublic"->'sbeMetaArn' IS NOT NULL OR "configPublic"->'adminApiUrl' IS NOT NULL;`
    );
    // ownership sb unique
    await queryRunner.query(
      `ALTER TABLE "ownership" ADD CONSTRAINT "UQ_99758503ba9f18ec99ab8d72384" UNIQUE ("teamId", "sbEnvironmentId")`
    );
    // tweak tenant crud privileges
    await queryRunner.query(
      `UPDATE "role" SET "privilegeIds" = array_remove(
          array_remove(
            "privilegeIds",
            'team.sb-environment.edfi-tenant:refresh-resources'
          ),
          'team.sb-environment:refresh-resources'
        )`
    );
    // add ownership view
    await queryRunner.query(`CREATE VIEW "ownership_view" AS SELECT ownership."id",
            ownership."teamId",
            ownership."roleId",
            CASE
                WHEN "ownership"."edorgId" IS NOT NULL then 'Edorg'
                WHEN ownership."odsId" IS NOT NULL THEN 'Ods'
                WHEN ownership."edfiTenantId" IS NOT NULL THEN 'EdfiTenant'
                ELSE 'SbEnvironment' END "resourceType",
            sb_environment.name ||
            CASE WHEN edfi_tenant."name" IS NOT NULL THEN ' / ' || edfi_tenant."name" ELSE '' END ||
            CASE WHEN ods."dbName" IS NOT NULL THEN ' / ' || ods."dbName" ELSE '' END ||
            CASE
                WHEN edorg."shortNameOfInstitution" IS NOT NULL THEN ' / ' || edorg."shortNameOfInstitution"
                ELSE '' END              "resourceText"
            FROM ownership
              LEFT JOIN edorg ON ownership."edorgId" = edorg.id
              LEFT JOIN ods ON ownership."odsId" = ods.id OR edorg."odsId" = ods.id
              LEFT JOIN edfi_tenant ON ownership."edfiTenantId" = edfi_tenant.id OR ods."edfiTenantId" = edfi_tenant.id
              LEFT JOIN sb_environment ON ownership."sbEnvironmentId" = sb_environment.id or
                                          edfi_tenant."sbEnvironmentId" = sb_environment.id`);
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
      [
        'public',
        'VIEW',
        'ownership_view',
        'SELECT ownership."id",\nownership."teamId",\nownership."roleId",\nCASE\n    WHEN "ownership"."edorgId" IS NOT NULL then \'Edorg\'\n    WHEN ownership."odsId" IS NOT NULL THEN \'Ods\'\n    WHEN ownership."edfiTenantId" IS NOT NULL THEN \'EdfiTenant\'\n    ELSE \'SbEnvironment\' END "resourceType",\nsb_environment.name ||\nCASE WHEN edfi_tenant."name" IS NOT NULL THEN \' / \' || edfi_tenant."name" ELSE \'\' END ||\nCASE WHEN ods."dbName" IS NOT NULL THEN \' / \' || ods."dbName" ELSE \'\' END ||\nCASE\n    WHEN edorg."shortNameOfInstitution" IS NOT NULL THEN \' / \' || edorg."shortNameOfInstitution"\n    ELSE \'\' END              "resourceText"\nFROM ownership\n  LEFT JOIN edorg ON ownership."edorgId" = edorg.id\n  LEFT JOIN ods ON ownership."odsId" = ods.id OR edorg."odsId" = ods.id\n  LEFT JOIN edfi_tenant ON ownership."edfiTenantId" = edfi_tenant.id OR ods."edfiTenantId" = edfi_tenant.id\n  LEFT JOIN sb_environment ON ownership."sbEnvironmentId" = sb_environment.id or\n                              edfi_tenant."sbEnvironmentId" = sb_environment.id',
      ]
    );
    // new sb sync queue
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
      ['VIEW', 'sb_sync_queue', 'public']
    );
    await queryRunner.query(`DROP VIEW "sb_sync_queue"`);

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
      // < begin some manual DDL (stuff not supported by typeorm)
      await queryRunner.query(
        `CREATE INDEX "sb_sync_queue_tsvector" ON "sb_sync_queue" USING gin (jsonb_to_tsvector('english', output, '["string"]'))`
      );
      await queryRunner.query(
        `CREATE FUNCTION refresh_sync_view() RETURNS TRIGGER LANGUAGE PLPGSQL AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.sb_sync_queue;
  RETURN NULL;
END;
$$;`
      );
      await queryRunner.query(
        `CREATE TRIGGER "sb_sync_queue_refresh_insert_update" AFTER INSERT OR UPDATE ON "pgboss"."job" FOR EACH ROW WHEN (NEW."name" = 'sbe-sync' OR NEW."name" = 'edfi-tenant-sync') EXECUTE FUNCTION refresh_sync_view();
      CREATE TRIGGER "sb_sync_queue_refresh_delete" AFTER DELETE ON "pgboss"."job" FOR EACH ROW WHEN (OLD."name" = 'sbe-sync' OR OLD."name" = 'edfi-tenant-sync') EXECUTE FUNCTION refresh_sync_view();`
      );
      // end some manual DDL />
      await queryRunner.query(
        `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
        [
          'public',
          'MATERIALIZED_VIEW',
          'sb_sync_queue',
          "with job as (select id, name, data, state, createdon, completedon, output\n      from pgboss.job\n      where name in ('sbe-sync', 'edfi-tenant-sync')\n      union\n      select id, name, data, state, createdon, completedon, output\n      from pgboss.archive\n      where name in ('sbe-sync', 'edfi-tenant-sync'))\n  select job.\"id\",\n  case when job.\"name\" = 'sbe-sync' then 'SbEnvironment' else 'EdfiTenant' end     \"type\",\n  coalesce(sb_environment.\"name\", edfi_tenant.\"name\", 'resource no longer exists') \"name\",\n  coalesce(sb_environment.\"id\", edfi_tenant.\"sbEnvironmentId\")                     \"sbEnvironmentId\",\n  edfi_tenant.\"id\"                                                                 \"edfiTenantId\",\n  \"data\"::text                                                                     \"dataText\",\n  data,\n  state,\n  createdon,\n  completedon,\n  output,\n  (job.output -> 'hasChanges')::bool                                               \"hasChanges\"\n  from job\n  left join public.sb_environment on (job.data -> 'sbEnvironmentId')::int = sb_environment.id\n  left join public.edfi_tenant on (job.data -> 'edfiTenantId')::int = edfi_tenant.id",
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
      // < begin some manual DDL (stuff not supported by typeorm)
      await queryRunner.query(
        `CREATE INDEX "sb_sync_queue_tsvector" ON "sb_sync_queue" USING gin (jsonb_to_tsvector('english', output, '["string"]'))`
      );
      await queryRunner.query(
        `CREATE FUNCTION refresh_sync_view() RETURNS TRIGGER LANGUAGE PLPGSQL AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.sb_sync_queue;
  RETURN NULL;
END;
$$;`
      );
      await queryRunner.query(
        `CREATE TRIGGER "sb_sync_queue_refresh_insert_update" AFTER INSERT OR UPDATE ON "pgboss"."job" FOR EACH ROW WHEN (NEW."name" = 'sbe-sync' OR NEW."name" = 'edfi-tenant-sync') EXECUTE FUNCTION refresh_sync_view();
      CREATE TRIGGER "sb_sync_queue_refresh_delete" AFTER DELETE ON "pgboss"."job" FOR EACH ROW WHEN (OLD."name" = 'sbe-sync' OR OLD."name" = 'edfi-tenant-sync') EXECUTE FUNCTION refresh_sync_view();`
      );
      // end some manual DDL />
      await queryRunner.query(
        `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
        [
          'public',
          'MATERIALIZED_VIEW',
          'sb_sync_queue',
          "with job as (select id, name, data, state, created_on as createdon, completed_on as completedon, output\n      from pgboss.job\n      where name in ('sbe-sync', 'edfi-tenant-sync'))\n  select job.\"id\",\n  case when job.\"name\" = 'sbe-sync' then 'SbEnvironment' else 'EdfiTenant' end     \"type\",\n  coalesce(sb_environment.\"name\", edfi_tenant.\"name\", 'resource no longer exists') \"name\",\n  coalesce(sb_environment.\"id\", edfi_tenant.\"sbEnvironmentId\")                     \"sbEnvironmentId\",\n  edfi_tenant.\"id\"                                                                 \"edfiTenantId\",\n  \"data\"::text                                                                     \"dataText\",\n  data,\n  state,\n  createdon,\n  completedon,\n  output,\n  (job.output -> 'hasChanges')::bool                                               \"hasChanges\"\n  from job\n  left join public.sb_environment on (job.data -> 'sbEnvironmentId')::int = sb_environment.id\n  left join public.edfi_tenant on (job.data -> 'edfiTenantId')::int = edfi_tenant.id",
        ]
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    throw new Error('v7 changes are not reversible. Please restore from backup.');
  }
}
