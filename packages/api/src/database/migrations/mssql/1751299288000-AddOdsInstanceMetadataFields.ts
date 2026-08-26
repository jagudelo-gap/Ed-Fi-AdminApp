import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOdsInstanceMetadataFields1751299288000 implements MigrationInterface {
  name = 'AddOdsInstanceMetadataFields1751299288000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE [ods] ADD [status] NVARCHAR(255) NULL`);
    await queryRunner.query(`ALTER TABLE [ods] ADD [databaseTemplate] NVARCHAR(255) NULL`);
    await queryRunner.query(`ALTER TABLE [ods] ADD [databaseName] NVARCHAR(255) NULL`);
    await queryRunner.query(`ALTER TABLE [ods] ADD [instanceType] NVARCHAR(255) NULL`);
    await queryRunner.query(`ALTER TABLE [ods] ADD [dbInstanceId] int NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE [ods] DROP COLUMN [dbInstanceId]`);
    await queryRunner.query(`ALTER TABLE [ods] DROP COLUMN [instanceType]`);
    await queryRunner.query(`ALTER TABLE [ods] DROP COLUMN [databaseName]`);
    await queryRunner.query(`ALTER TABLE [ods] DROP COLUMN [databaseTemplate]`);
    await queryRunner.query(`ALTER TABLE [ods] DROP COLUMN [status]`);
  }
}
