import 'reflect-metadata';
import { QueryRunner } from 'typeorm';
import { NewSbSyncQueue1692740626759 } from './1692740626759-NewSbSyncQueue';
import { runMigrationSmokeTest } from '../../../test/helpers/migration-smoke-test.helper';

runMigrationSmokeTest(NewSbSyncQueue1692740626759);

describe('NewSbSyncQueue1692740626759 legacy branch', () => {
  it('creates the legacy sb_sync_queue view when pgboss.archive exists', async () => {
    const queryRunner = {
      query: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ hasArchive: true }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
    } as unknown as QueryRunner;

    await new NewSbSyncQueue1692740626759().up(queryRunner);

    expect((queryRunner.query as jest.Mock).mock.calls[2][0]).toContain('from pgboss.archive');
    expect((queryRunner.query as jest.Mock).mock.calls[2][0]).toContain('union all');
  });
});
