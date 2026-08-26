import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameDbInstanceIdToInstanceManageId1785365966591 implements MigrationInterface {
  name = 'RenameDbInstanceIdToInstanceManageId1785365966591';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ods" RENAME COLUMN "dbInstanceId" TO "instanceManageId"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ods" RENAME COLUMN "instanceManageId" TO "dbInstanceId"`);
  }
}
