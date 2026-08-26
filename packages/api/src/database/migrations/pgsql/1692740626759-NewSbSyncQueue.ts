import { MigrationInterface, QueryRunner } from 'typeorm';
import { hasPgbossArchive } from './pgboss-compat';

export class NewSbSyncQueue1692740626759 implements MigrationInterface {
  name = 'NewSbSyncQueue1692740626759';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "privilege" (name, description, code) VALUES ('sb-sync-queue:read', 'Read SB sync queue in the global scope.', 'sb-sync-queue:read'), ('sb-sync-queue:archive', 'Archive SB sync queue in the global scope.', 'sb-sync-queue:archive')`
    );

    const archiveExists = await hasPgbossArchive(queryRunner);

    if (archiveExists) {
      // Legacy branch: pg-boss ≤v9 camelCase schema with pgboss.archive table
      await queryRunner.query(`CREATE VIEW "sb_sync_queue" AS
  select "id",
       "name",
       "priority",
       "data",
       "state",
       "retrylimit",
       "retrycount",
       "retrydelay",
       "retrybackoff",
       "startafter",
       "startedon",
       "singletonkey",
       "singletonon",
       "expirein",
       "createdon",
       "completedon",
       "keepuntil",
       "on_complete",
       "output",
       "archivedon"
from pgboss.archive
where name = 'sbe-sync'
union all
select "id",
       "name",
       "priority",
       "data",
       "state",
       "retrylimit",
       "retrycount",
       "retrydelay",
       "retrybackoff",
       "startafter",
       "startedon",
       "singletonkey",
       "singletonon",
       "expirein",
       "createdon",
       "completedon",
       "keepuntil",
       "on_complete",
       "output",
       null "archivedon"
from pgboss.job
where name = 'sbe-sync'
  `);
      await queryRunner.query(
        `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
        [
          'public',
          'VIEW',
          'sb_sync_queue',
          'select "id",\n       "name",\n       "priority",\n       "data",\n       "state",\n       "retrylimit",\n       "retrycount",\n       "retrydelay",\n       "retrybackoff",\n       "startafter",\n       "startedon",\n       "singletonkey",\n       "singletonon",\n       "expirein",\n       "createdon",\n       "completedon",\n       "keepuntil",\n       "on_complete",\n       "output",\n       "archivedon"\nfrom pgboss.archive\nwhere name = \'sbe-sync\'\nunion all\nselect "id",\n       "name",\n       "priority",\n       "data",\n       "state",\n       "retrylimit",\n       "retrycount",\n       "retrydelay",\n       "retrybackoff",\n       "startafter",\n       "startedon",\n       "singletonkey",\n       "singletonon",\n       "expirein",\n       "createdon",\n       "completedon",\n       "keepuntil",\n       "on_complete",\n       "output",\n       null "archivedon"\nfrom pgboss.job\nwhere name = \'sbe-sync\'',
        ]
      );
    } else {
      // v12 branch: pg-boss v10+ snake_case schema — pgboss.archive no longer exists
      await queryRunner.query(`CREATE VIEW "sb_sync_queue" AS
  select "id",
       "name",
       "priority",
       "data",
       "state",
       retry_limit as "retrylimit",
       retry_count as "retrycount",
       retry_delay as "retrydelay",
       retry_backoff as "retrybackoff",
       start_after as "startafter",
       started_on as "startedon",
       singleton_key as "singletonkey",
       singleton_on as "singletonon",
       expire_seconds as "expirein",
       created_on as "createdon",
       completed_on as "completedon",
       keep_until as "keepuntil",
       null as "on_complete",
       "output",
       null as "archivedon"
from pgboss.job
where name = 'sbe-sync'
  `);
      await queryRunner.query(
        `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
        [
          'public',
          'VIEW',
          'sb_sync_queue',
          'select "id",\n       "name",\n       "priority",\n       "data",\n       "state",\n       retry_limit as "retrylimit",\n       retry_count as "retrycount",\n       retry_delay as "retrydelay",\n       retry_backoff as "retrybackoff",\n       start_after as "startafter",\n       started_on as "startedon",\n       singleton_key as "singletonkey",\n       singleton_on as "singletonon",\n       expire_seconds as "expirein",\n       created_on as "createdon",\n       completed_on as "completedon",\n       keep_until as "keepuntil",\n       null as "on_complete",\n       "output",\n       null as "archivedon"\nfrom pgboss.job\nwhere name = \'sbe-sync\'',
        ]
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "privilege" WHERE "code" in ('sb-sync-queue:read', 'sb-sync-queue:archive')`
    );

    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
      ['VIEW', 'sb_sync_queue', 'public']
    );
    await queryRunner.query(`DROP VIEW "sb_sync_queue"`);
  }
}
