import 'reflect-metadata';
import { QueryRunner } from 'typeorm';
import { EnvNav1710178189458 } from './1710178189458-EnvNav';
import { runMigrationSmokeTest } from '../../../test/helpers/migration-smoke-test.helper';

runMigrationSmokeTest(EnvNav1710178189458);

describe('EnvNav1710178189458 legacy branch', () => {
  function makeLegacyQueryRunner(): QueryRunner {
    return {
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes("to_regclass('pgboss.archive')")) {
          return Promise.resolve([{ hasArchive: true }]);
        }
        return Promise.resolve([{}]);
      }),
    } as unknown as QueryRunner;
  }

  function makeV12QueryRunner(): QueryRunner {
    return {
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes("to_regclass('pgboss.archive')")) {
          return Promise.resolve([{ hasArchive: false }]);
        }
        return Promise.resolve([{}]);
      }),
    } as unknown as QueryRunner;
  }

  describe('up()', () => {
    it('creates the legacy sb_sync_queue materialized view when pgboss.archive exists', async () => {
      const queryRunner = makeLegacyQueryRunner();

      await new EnvNav1710178189458().up(queryRunner);

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
      expect(matViewCall).toContain('"sbEnvironmentId"');
      expect(matViewCall).toContain('"edfiTenantId"');
      expect(matViewCall).toContain('"dataText"');
    });

    it('creates the v12 sb_sync_queue materialized view when pgboss.archive does not exist', async () => {
      const queryRunner = makeV12QueryRunner();

      await new EnvNav1710178189458().up(queryRunner);

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
      expect(matViewCall).toContain('"sbEnvironmentId"');
      expect(matViewCall).toContain('"edfiTenantId"');
      expect(matViewCall).toContain('"dataText"');
    });

    it('always creates the env_nav view regardless of branch', async () => {
      for (const queryRunner of [makeLegacyQueryRunner(), makeV12QueryRunner()]) {
        await new EnvNav1710178189458().up(queryRunner);

        const calls: string[] = (queryRunner.query as jest.Mock).mock.calls.map(
          (c: unknown[]) => c[0] as string
        );
        const envNavCall = calls.find(
          (sql) => sql.includes('CREATE VIEW') && sql.includes('env_nav')
        );
        expect(envNavCall).toBeDefined();
        expect(envNavCall).toContain('sbEnvironmentName');
      }
    });
  });

  describe('down()', () => {
    it('restores the legacy sb_sync_queue materialized view when pgboss.archive exists', async () => {
      const queryRunner = makeLegacyQueryRunner();

      await new EnvNav1710178189458().down(queryRunner);

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
      expect(matViewCall).toContain('"sbEnvironmentId"');
      expect(matViewCall).toContain('"edfiTenantId"');
      expect(matViewCall).toContain('"dataText"');
    });

    it('restores the v12 sb_sync_queue materialized view when pgboss.archive does not exist', async () => {
      const queryRunner = makeV12QueryRunner();

      await new EnvNav1710178189458().down(queryRunner);

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
      expect(matViewCall).toContain('"sbEnvironmentId"');
      expect(matViewCall).toContain('"edfiTenantId"');
      expect(matViewCall).toContain('"dataText"');
    });
  });
});
