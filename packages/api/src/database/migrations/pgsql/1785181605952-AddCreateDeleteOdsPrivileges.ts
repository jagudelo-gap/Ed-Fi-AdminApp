import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCreateDeleteOdsPrivileges1785181605952 implements MigrationInterface {
  name = 'AddCreateDeleteOdsPrivileges1785181605952';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add create-ods/delete-ods privileges to Tenant admin role (ID 6)
    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_append("privilegeIds", 'team.sb-environment.edfi-tenant:create-ods') WHERE id = 6 AND NOT ('team.sb-environment.edfi-tenant:create-ods' = ANY("privilegeIds"))`
    );
    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_append("privilegeIds", 'team.sb-environment.edfi-tenant:delete-ods') WHERE id = 6 AND NOT ('team.sb-environment.edfi-tenant:delete-ods' = ANY("privilegeIds"))`
    );

    // Add create-ods/delete-ods privileges to Full ownership role (ID 5)
    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_append("privilegeIds", 'team.sb-environment.edfi-tenant:create-ods') WHERE id = 5 AND NOT ('team.sb-environment.edfi-tenant:create-ods' = ANY("privilegeIds"))`
    );
    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_append("privilegeIds", 'team.sb-environment.edfi-tenant:delete-ods') WHERE id = 5 AND NOT ('team.sb-environment.edfi-tenant:delete-ods' = ANY("privilegeIds"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove create-ods/delete-ods privileges from Tenant admin role (ID 6)
    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_remove("privilegeIds", 'team.sb-environment.edfi-tenant:create-ods') WHERE id = 6`
    );
    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_remove("privilegeIds", 'team.sb-environment.edfi-tenant:delete-ods') WHERE id = 6`
    );

    // Remove create-ods/delete-ods privileges from Full ownership role (ID 5)
    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_remove("privilegeIds", 'team.sb-environment.edfi-tenant:create-ods') WHERE id = 5`
    );
    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_remove("privilegeIds", 'team.sb-environment.edfi-tenant:delete-ods') WHERE id = 5`
    );
  }
}
