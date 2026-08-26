import 'reflect-metadata';
import { QueryRunner } from 'typeorm';
import { V7Changes1709328882890 } from './1709328882890-v7-changes';
import { runMigrationSmokeTest } from '../../../test/helpers/migration-smoke-test.helper';

runMigrationSmokeTest(V7Changes1709328882890);

describe('V7Changes1709328882890 legacy branch', () => {
  it('creates the legacy sb_sync_queue materialized view when pgboss.archive exists', async () => {
    const queryRunner = {
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes("to_regclass('pgboss.archive')")) {
          return Promise.resolve([{ hasArchive: true }]);
        }
        return Promise.resolve([{}]);
      }),
    } as unknown as QueryRunner;

    await new V7Changes1709328882890().up(queryRunner);

    const calls: string[] = (queryRunner.query as jest.Mock).mock.calls.map(
      (c: unknown[]) => c[0] as string
    );
    const matViewCall = calls.find(
      (sql) => sql.includes('CREATE MATERIALIZED VIEW') && sql.includes('sb_sync_queue')
    );
    expect(matViewCall).toBeDefined();
    expect(matViewCall).toContain('from pgboss.archive');
    expect(matViewCall).toContain('union');
    expect(matViewCall).not.toContain('created_on as createdon');
  });

  it('creates the v12 sb_sync_queue materialized view when pgboss.archive does not exist', async () => {
    const queryRunner = {
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes("to_regclass('pgboss.archive')")) {
          return Promise.resolve([{ hasArchive: false }]);
        }
        return Promise.resolve([{}]);
      }),
    } as unknown as QueryRunner;

    await new V7Changes1709328882890().up(queryRunner);

    const calls: string[] = (queryRunner.query as jest.Mock).mock.calls.map(
      (c: unknown[]) => c[0] as string
    );
    const matViewCall = calls.find(
      (sql) => sql.includes('CREATE MATERIALIZED VIEW') && sql.includes('sb_sync_queue')
    );
    expect(matViewCall).toBeDefined();
    expect(matViewCall).not.toContain('from pgboss.archive');
    expect(matViewCall).toContain('created_on as createdon');
    expect(matViewCall).toContain('completed_on as completedon');
  });
});
