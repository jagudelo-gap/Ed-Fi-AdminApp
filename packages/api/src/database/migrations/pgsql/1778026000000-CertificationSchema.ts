import { MigrationInterface, QueryRunner } from 'typeorm';

export class CertificationSchema1778026000000 implements MigrationInterface {
  name = 'CertificationSchema1778026000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create schema
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "cert"`);

    // 2. catalog_version
    await queryRunner.query(`
      CREATE TABLE "cert"."catalog_version" (
        "catalogVersionId"    SERIAL NOT NULL,
        "artifactVersion"     character varying(255) NOT NULL,
        "dataStandardVersion" character varying(10) NOT NULL,
        "importedAt"          TIMESTAMP NOT NULL DEFAULT now(),
        "isActive"            boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_cert_catalog_version" PRIMARY KEY ("catalogVersionId")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_cert_catalog_version_artifact_dataStandard"
      ON "cert"."catalog_version" ("artifactVersion", "dataStandardVersion")
    `);

    // 3. area_catalog
    await queryRunner.query(`
      CREATE TABLE "cert"."area_catalog" (
        "areaId"           SERIAL NOT NULL,
        "catalogVersionId" integer NOT NULL,
        "name"             character varying(255) NOT NULL,
        "displayName"      character varying(255) NULL,
        "displayOrder"     integer NOT NULL,
        "isEnabled"        boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_cert_area_catalog" PRIMARY KEY ("areaId")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "cert"."area_catalog"
        ADD CONSTRAINT "FK_cert_area_catalog_catalogVersion"
        FOREIGN KEY ("catalogVersionId")
        REFERENCES "cert"."catalog_version"("catalogVersionId")
        ON DELETE CASCADE
    `);

    // 4. scenario_catalog
    await queryRunner.query(`
      CREATE TABLE "cert"."scenario_catalog" (
        "scenarioId"   SERIAL NOT NULL,
        "areaId"       integer NOT NULL,
        "name"         character varying(255) NOT NULL,
        "displayName"  character varying(255) NULL,
        "displayOrder" integer NOT NULL,
        "isEnabled"    boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_cert_scenario_catalog" PRIMARY KEY ("scenarioId")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "cert"."scenario_catalog"
        ADD CONSTRAINT "FK_cert_scenario_catalog_area"
        FOREIGN KEY ("areaId")
        REFERENCES "cert"."area_catalog"("areaId")
        ON DELETE CASCADE
    `);

    // 5. step_catalog
    await queryRunner.query(`
      CREATE TABLE "cert"."step_catalog" (
        "stepId"       SERIAL NOT NULL,
        "scenarioId"   integer NOT NULL,
        "stepName"     character varying(255) NOT NULL,
        "displayName"  character varying(255) NULL,
        "stepType"     character varying(50) NOT NULL,
        "displayOrder" integer NOT NULL,
        "isEnabled"    boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_cert_step_catalog" PRIMARY KEY ("stepId")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "cert"."step_catalog"
        ADD CONSTRAINT "FK_cert_step_catalog_scenario"
        FOREIGN KEY ("scenarioId")
        REFERENCES "cert"."scenario_catalog"("scenarioId")
        ON DELETE CASCADE
    `);

    // 6. step_parameter_catalog
    await queryRunner.query(`
      CREATE TABLE "cert"."step_parameter_catalog" (
        "parameterId"  SERIAL NOT NULL,
        "stepId"       integer NOT NULL,
        "type"         character varying(100) NOT NULL,
        "name"         character varying(255) NOT NULL,
        "description"  text,
        CONSTRAINT "PK_cert_step_parameter_catalog" PRIMARY KEY ("parameterId")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "cert"."step_parameter_catalog"
        ADD CONSTRAINT "FK_cert_step_parameter_catalog_step"
        FOREIGN KEY ("stepId")
        REFERENCES "cert"."step_catalog"("stepId")
        ON DELETE CASCADE
    `);

    // 7. certification_ods_api
    await queryRunner.query(`
      CREATE TABLE "cert"."certification_ods_api" (
        "odsId"    SERIAL NOT NULL,
        "odsUrl"   character varying(2048) NOT NULL,
        "clientId" character varying(255) NOT NULL,
        CONSTRAINT "PK_cert_certification_ods_api" PRIMARY KEY ("odsId")
      )
    `);

    // 8. certification_process
    await queryRunner.query(`
      CREATE TABLE "cert"."certification_process" (
        "certificationProcessId" SERIAL NOT NULL,
        "odsId"                  integer NOT NULL,
        "catalogVersionId"       integer NOT NULL,
        "status"                 character varying(50) NOT NULL,
        "createdAt"              TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"              TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cert_certification_process" PRIMARY KEY ("certificationProcessId")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "cert"."certification_process"
        ADD CONSTRAINT "FK_cert_certification_process_ods"
        FOREIGN KEY ("odsId")
        REFERENCES "cert"."certification_ods_api"("odsId")
        ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "cert"."certification_process"
        ADD CONSTRAINT "FK_cert_certification_process_catalogVersion"
        FOREIGN KEY ("catalogVersionId")
        REFERENCES "cert"."catalog_version"("catalogVersionId")
        ON DELETE RESTRICT
    `);

    // 9. certification_process_scenario (composite PK)
    await queryRunner.query(`
      CREATE TABLE "cert"."certification_process_scenario" (
        "certificationProcessId" integer NOT NULL,
        "scenarioId"             integer NOT NULL,
        "status"                 character varying(50) NOT NULL,
        CONSTRAINT "PK_cert_certification_process_scenario"
          PRIMARY KEY ("certificationProcessId", "scenarioId")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "cert"."certification_process_scenario"
        ADD CONSTRAINT "FK_cert_process_scenario_process"
        FOREIGN KEY ("certificationProcessId")
        REFERENCES "cert"."certification_process"("certificationProcessId")
        ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "cert"."certification_process_scenario"
        ADD CONSTRAINT "FK_cert_process_scenario_scenario"
        FOREIGN KEY ("scenarioId")
        REFERENCES "cert"."scenario_catalog"("scenarioId")
        ON DELETE CASCADE
    `);

    // 10. scenario_step
    await queryRunner.query(`
      CREATE TABLE "cert"."scenario_step" (
        "stepRunId"              SERIAL NOT NULL,
        "certificationProcessId" integer NOT NULL,
        "scenarioId"             integer NOT NULL,
        "stepId"                 integer NOT NULL,
        "status"                 character varying(50) NOT NULL,
        "runAt"                  TIMESTAMP,
        CONSTRAINT "PK_cert_scenario_step" PRIMARY KEY ("stepRunId")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "cert"."scenario_step"
        ADD CONSTRAINT "FK_cert_scenario_step_process"
        FOREIGN KEY ("certificationProcessId")
        REFERENCES "cert"."certification_process"("certificationProcessId")
        ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "cert"."scenario_step"
        ADD CONSTRAINT "FK_cert_scenario_step_scenario"
        FOREIGN KEY ("scenarioId")
        REFERENCES "cert"."scenario_catalog"("scenarioId")
        ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE "cert"."scenario_step"
        ADD CONSTRAINT "FK_cert_scenario_step_step"
        FOREIGN KEY ("stepId")
        REFERENCES "cert"."step_catalog"("stepId")
        ON DELETE RESTRICT
    `);

    // 11. scenario_step_error
    await queryRunner.query(`
      CREATE TABLE "cert"."scenario_step_error" (
        "errorId"     SERIAL NOT NULL,
        "stepRunId"   integer NOT NULL,
        "description" text,
        "validation"  text,
        CONSTRAINT "PK_cert_scenario_step_error" PRIMARY KEY ("errorId")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "cert"."scenario_step_error"
        ADD CONSTRAINT "FK_cert_scenario_step_error_stepRun"
        FOREIGN KEY ("stepRunId")
        REFERENCES "cert"."scenario_step"("stepRunId")
        ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop leaf tables first, then parents — CASCADE handles FK-dependent rows
    await queryRunner.query(`DROP TABLE IF EXISTS "cert"."scenario_step_error" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cert"."scenario_step" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cert"."certification_process_scenario" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cert"."certification_process" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cert"."certification_ods_api" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cert"."step_parameter_catalog" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cert"."step_catalog" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cert"."scenario_catalog" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cert"."area_catalog" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cert"."catalog_version" CASCADE`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS "cert"`);
  }
}
