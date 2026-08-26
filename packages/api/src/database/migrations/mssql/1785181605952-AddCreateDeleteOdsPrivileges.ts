import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCreateDeleteOdsPrivileges1785181605952 implements MigrationInterface {
  name = 'AddCreateDeleteOdsPrivileges1785181605952';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add create-ods/delete-ods privileges to Tenant admin role (ID 6)
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = CASE WHEN LEN([privilegeIds]) > 0 THEN [privilegeIds] + ',team.sb-environment.edfi-tenant:create-ods' ELSE 'team.sb-environment.edfi-tenant:create-ods' END WHERE id = 6 AND [privilegeIds] NOT LIKE '%team.sb-environment.edfi-tenant:create-ods%'`
    );
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = CASE WHEN LEN([privilegeIds]) > 0 THEN [privilegeIds] + ',team.sb-environment.edfi-tenant:delete-ods' ELSE 'team.sb-environment.edfi-tenant:delete-ods' END WHERE id = 6 AND [privilegeIds] NOT LIKE '%team.sb-environment.edfi-tenant:delete-ods%'`
    );

    // Add create-ods/delete-ods privileges to Full ownership role (ID 5)
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = CASE WHEN LEN([privilegeIds]) > 0 THEN [privilegeIds] + ',team.sb-environment.edfi-tenant:create-ods' ELSE 'team.sb-environment.edfi-tenant:create-ods' END WHERE id = 5 AND [privilegeIds] NOT LIKE '%team.sb-environment.edfi-tenant:create-ods%'`
    );
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = CASE WHEN LEN([privilegeIds]) > 0 THEN [privilegeIds] + ',team.sb-environment.edfi-tenant:delete-ods' ELSE 'team.sb-environment.edfi-tenant:delete-ods' END WHERE id = 5 AND [privilegeIds] NOT LIKE '%team.sb-environment.edfi-tenant:delete-ods%'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove create-ods/delete-ods privileges from Tenant admin role (ID 6)
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = REPLACE(',' + [privilegeIds] + ',', ',team.sb-environment.edfi-tenant:create-ods,', ',') WHERE id = 6`
    );
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = REPLACE(',' + [privilegeIds] + ',', ',team.sb-environment.edfi-tenant:delete-ods,', ',') WHERE id = 6`
    );

    // Remove create-ods/delete-ods privileges from Full ownership role (ID 5)
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = REPLACE(',' + [privilegeIds] + ',', ',team.sb-environment.edfi-tenant:create-ods,', ',') WHERE id = 5`
    );
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = REPLACE(',' + [privilegeIds] + ',', ',team.sb-environment.edfi-tenant:delete-ods,', ',') WHERE id = 5`
    );

    // Clean up leading/trailing commas left by REPLACE
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = TRIM(',' FROM [privilegeIds]) WHERE id IN (5, 6)`
    );
  }
}
