import { QueryRunner } from 'typeorm';

/**
 * Checks whether the `pgboss.archive` table exists in the current database.
 * Used for pg-boss v12 migration compatibility: the table was removed in v10+
 * and migrations that reference it must guard against its absence.
 *
 * @param queryRunner - TypeORM QueryRunner used to execute the probe query
 * @returns `true` when `pgboss.archive` exists, `false` otherwise
 */
export async function hasPgbossArchive(queryRunner: QueryRunner): Promise<boolean> {
  const result: Array<{ hasArchive: boolean }> = await queryRunner.query(
    `select to_regclass('pgboss.archive') is not null as "hasArchive"`
  );
  return result[0]?.hasArchive === true;
}
