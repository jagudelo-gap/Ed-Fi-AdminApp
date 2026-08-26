import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameDbInstanceIdToInstanceManageId1785365966591 implements MigrationInterface {
  name = 'RenameDbInstanceIdToInstanceManageId1785365966591';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`EXEC sp_rename '[ods].[dbInstanceId]', 'instanceManageId', 'COLUMN'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`EXEC sp_rename '[ods].[instanceManageId]', 'dbInstanceId', 'COLUMN'`);
  }
}
