import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOdsInstanceMetadataFields1751299288000 implements MigrationInterface {
  name = 'AddOdsInstanceMetadataFields1751299288000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ods" ADD "status" character varying`);
    await queryRunner.query(`ALTER TABLE "ods" ADD "databaseTemplate" character varying`);
    await queryRunner.query(`ALTER TABLE "ods" ADD "databaseName" character varying`);
    await queryRunner.query(`ALTER TABLE "ods" ADD "instanceType" character varying`);
    await queryRunner.query(`ALTER TABLE "ods" ADD "dbInstanceId" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ods" DROP COLUMN "dbInstanceId"`);
    await queryRunner.query(`ALTER TABLE "ods" DROP COLUMN "instanceType"`);
    await queryRunner.query(`ALTER TABLE "ods" DROP COLUMN "databaseName"`);
    await queryRunner.query(`ALTER TABLE "ods" DROP COLUMN "databaseTemplate"`);
    await queryRunner.query(`ALTER TABLE "ods" DROP COLUMN "status"`);
  }
}
