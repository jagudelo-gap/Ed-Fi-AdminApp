import { MigrationInterface, QueryRunner } from 'typeorm';

export class CertificationSchema1778026000000 implements MigrationInterface {
  name = 'CertificationSchema1778026000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create schema
    await queryRunner.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'cert')
        EXEC('CREATE SCHEMA [cert]')
    `);

    // 2. catalog_version
    await queryRunner.query(`
      CREATE TABLE [cert].[catalog_version] (
        [catalogVersionId]    INT IDENTITY(1,1) NOT NULL,
        [artifactVersion]     NVARCHAR(255) NOT NULL,
        [dataStandardVersion] NVARCHAR(10) NOT NULL,
        [importedAt]          datetime2 NOT NULL DEFAULT getdate(),
        [isActive]            bit NOT NULL DEFAULT 0,
        CONSTRAINT [PK_cert_catalog_version] PRIMARY KEY ([catalogVersionId])
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX [UQ_cert_catalog_version_artifact_dataStandard]
      ON [cert].[catalog_version] ([artifactVersion], [dataStandardVersion])
    `);

    // 3. area_catalog
    await queryRunner.query(`
      CREATE TABLE [cert].[area_catalog] (
        [areaId]           INT IDENTITY(1,1) NOT NULL,
        [catalogVersionId] INT NOT NULL,
        [name]             NVARCHAR(255) NOT NULL,
        [displayName]      NVARCHAR(255) NULL,
        [displayOrder]     INT NOT NULL,
        [isEnabled]        bit NOT NULL DEFAULT 1,
        CONSTRAINT [PK_cert_area_catalog] PRIMARY KEY ([areaId])
      )
    `);
    await queryRunner.query(`
      ALTER TABLE [cert].[area_catalog]
        ADD CONSTRAINT [FK_cert_area_catalog_catalogVersion]
        FOREIGN KEY ([catalogVersionId])
        REFERENCES [cert].[catalog_version]([catalogVersionId])
        ON DELETE CASCADE
    `);

    // 4. scenario_catalog
    await queryRunner.query(`
      CREATE TABLE [cert].[scenario_catalog] (
        [scenarioId]   INT IDENTITY(1,1) NOT NULL,
        [areaId]       INT NOT NULL,
        [name]         NVARCHAR(255) NOT NULL,
        [displayName]  NVARCHAR(255) NULL,
        [displayOrder] INT NOT NULL,
        [isEnabled]    bit NOT NULL DEFAULT 1,
        CONSTRAINT [PK_cert_scenario_catalog] PRIMARY KEY ([scenarioId])
      )
    `);
    await queryRunner.query(`
      ALTER TABLE [cert].[scenario_catalog]
        ADD CONSTRAINT [FK_cert_scenario_catalog_area]
        FOREIGN KEY ([areaId])
        REFERENCES [cert].[area_catalog]([areaId])
        ON DELETE CASCADE
    `);

    // 5. step_catalog
    await queryRunner.query(`
      CREATE TABLE [cert].[step_catalog] (
        [stepId]       INT IDENTITY(1,1) NOT NULL,
        [scenarioId]   INT NOT NULL,
        [stepName]     NVARCHAR(255) NOT NULL,
        [displayName]  NVARCHAR(255) NULL,
        [stepType]     NVARCHAR(50) NOT NULL,
        [displayOrder] INT NOT NULL,
        [isEnabled]    bit NOT NULL DEFAULT 1,
        CONSTRAINT [PK_cert_step_catalog] PRIMARY KEY ([stepId])
      )
    `);
    await queryRunner.query(`
      ALTER TABLE [cert].[step_catalog]
        ADD CONSTRAINT [FK_cert_step_catalog_scenario]
        FOREIGN KEY ([scenarioId])
        REFERENCES [cert].[scenario_catalog]([scenarioId])
        ON DELETE CASCADE
    `);

    // 6. step_parameter_catalog
    await queryRunner.query(`
      CREATE TABLE [cert].[step_parameter_catalog] (
        [parameterId]  INT IDENTITY(1,1) NOT NULL,
        [stepId]       INT NOT NULL,
        [type]         NVARCHAR(100) NOT NULL,
        [name]         NVARCHAR(255) NOT NULL,
        [description]  NVARCHAR(max),
        CONSTRAINT [PK_cert_step_parameter_catalog] PRIMARY KEY ([parameterId])
      )
    `);
    await queryRunner.query(`
      ALTER TABLE [cert].[step_parameter_catalog]
        ADD CONSTRAINT [FK_cert_step_parameter_catalog_step]
        FOREIGN KEY ([stepId])
        REFERENCES [cert].[step_catalog]([stepId])
        ON DELETE CASCADE
    `);

    // 7. certification_ods_api
    await queryRunner.query(`
      CREATE TABLE [cert].[certification_ods_api] (
        [odsId]    INT IDENTITY(1,1) NOT NULL,
        [odsUrl]   NVARCHAR(2048) NOT NULL,
        [clientId] NVARCHAR(255) NOT NULL,
        CONSTRAINT [PK_cert_certification_ods_api] PRIMARY KEY ([odsId])
      )
    `);

    // 8. certification_process
    await queryRunner.query(`
      CREATE TABLE [cert].[certification_process] (
        [certificationProcessId] INT IDENTITY(1,1) NOT NULL,
        [odsId]                  INT NOT NULL,
        [catalogVersionId]       INT NOT NULL,
        [status]                 NVARCHAR(50) NOT NULL,
        [createdAt]              datetime2 NOT NULL DEFAULT getdate(),
        [updatedAt]              datetime2 NOT NULL DEFAULT getdate(),
        CONSTRAINT [PK_cert_certification_process] PRIMARY KEY ([certificationProcessId])
      )
    `);
    await queryRunner.query(`
      ALTER TABLE [cert].[certification_process]
        ADD CONSTRAINT [FK_cert_certification_process_ods]
        FOREIGN KEY ([odsId])
        REFERENCES [cert].[certification_ods_api]([odsId])
        ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE [cert].[certification_process]
        ADD CONSTRAINT [FK_cert_certification_process_catalogVersion]
        FOREIGN KEY ([catalogVersionId])
        REFERENCES [cert].[catalog_version]([catalogVersionId])
        ON DELETE NO ACTION
    `);

    // 9. certification_process_scenario (composite PK)
    await queryRunner.query(`
      CREATE TABLE [cert].[certification_process_scenario] (
        [certificationProcessId] INT NOT NULL,
        [scenarioId]             INT NOT NULL,
        [status]                 NVARCHAR(50) NOT NULL,
        CONSTRAINT [PK_cert_certification_process_scenario]
          PRIMARY KEY ([certificationProcessId], [scenarioId])
      )
    `);
    await queryRunner.query(`
      ALTER TABLE [cert].[certification_process_scenario]
        ADD CONSTRAINT [FK_cert_process_scenario_process]
        FOREIGN KEY ([certificationProcessId])
        REFERENCES [cert].[certification_process]([certificationProcessId])
        ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE [cert].[certification_process_scenario]
        ADD CONSTRAINT [FK_cert_process_scenario_scenario]
        FOREIGN KEY ([scenarioId])
        REFERENCES [cert].[scenario_catalog]([scenarioId])
        ON DELETE CASCADE
    `);

    // 10. scenario_step
    await queryRunner.query(`
      CREATE TABLE [cert].[scenario_step] (
        [stepRunId]              INT IDENTITY(1,1) NOT NULL,
        [certificationProcessId] INT NOT NULL,
        [scenarioId]             INT NOT NULL,
        [stepId]                 INT NOT NULL,
        [status]                 NVARCHAR(50) NOT NULL,
        [runAt]                  datetime2,
        CONSTRAINT [PK_cert_scenario_step] PRIMARY KEY ([stepRunId])
      )
    `);
    await queryRunner.query(`
      ALTER TABLE [cert].[scenario_step]
        ADD CONSTRAINT [FK_cert_scenario_step_process]
        FOREIGN KEY ([certificationProcessId])
        REFERENCES [cert].[certification_process]([certificationProcessId])
        ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE [cert].[scenario_step]
        ADD CONSTRAINT [FK_cert_scenario_step_scenario]
        FOREIGN KEY ([scenarioId])
        REFERENCES [cert].[scenario_catalog]([scenarioId])
        ON DELETE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE [cert].[scenario_step]
        ADD CONSTRAINT [FK_cert_scenario_step_step]
        FOREIGN KEY ([stepId])
        REFERENCES [cert].[step_catalog]([stepId])
        ON DELETE NO ACTION
    `);

    // 11. scenario_step_error
    await queryRunner.query(`
      CREATE TABLE [cert].[scenario_step_error] (
        [errorId]     INT IDENTITY(1,1) NOT NULL,
        [stepRunId]   INT NOT NULL,
        [description] NVARCHAR(max),
        [validation]  NVARCHAR(max),
        CONSTRAINT [PK_cert_scenario_step_error] PRIMARY KEY ([errorId])
      )
    `);
    await queryRunner.query(`
      ALTER TABLE [cert].[scenario_step_error]
        ADD CONSTRAINT [FK_cert_scenario_step_error_stepRun]
        FOREIGN KEY ([stepRunId])
        REFERENCES [cert].[scenario_step]([stepRunId])
        ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop leaf tables first — MSSQL requires explicit FK drops before schema drop
    await queryRunner.query(`IF OBJECT_ID('[cert].[scenario_step_error]', 'U') IS NOT NULL DROP TABLE [cert].[scenario_step_error]`);
    await queryRunner.query(`IF OBJECT_ID('[cert].[scenario_step]', 'U') IS NOT NULL DROP TABLE [cert].[scenario_step]`);
    await queryRunner.query(`IF OBJECT_ID('[cert].[certification_process_scenario]', 'U') IS NOT NULL DROP TABLE [cert].[certification_process_scenario]`);
    await queryRunner.query(`IF OBJECT_ID('[cert].[certification_process]', 'U') IS NOT NULL DROP TABLE [cert].[certification_process]`);
    await queryRunner.query(`IF OBJECT_ID('[cert].[certification_ods_api]', 'U') IS NOT NULL DROP TABLE [cert].[certification_ods_api]`);
    await queryRunner.query(`IF OBJECT_ID('[cert].[step_parameter_catalog]', 'U') IS NOT NULL DROP TABLE [cert].[step_parameter_catalog]`);
    await queryRunner.query(`IF OBJECT_ID('[cert].[step_catalog]', 'U') IS NOT NULL DROP TABLE [cert].[step_catalog]`);
    await queryRunner.query(`IF OBJECT_ID('[cert].[scenario_catalog]', 'U') IS NOT NULL DROP TABLE [cert].[scenario_catalog]`);
    await queryRunner.query(`IF OBJECT_ID('[cert].[area_catalog]', 'U') IS NOT NULL DROP TABLE [cert].[area_catalog]`);
    await queryRunner.query(`IF OBJECT_ID('[cert].[catalog_version]', 'U') IS NOT NULL DROP TABLE [cert].[catalog_version]`);
    await queryRunner.query(`IF EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'cert') EXEC('DROP SCHEMA [cert]')`);
  }
}
