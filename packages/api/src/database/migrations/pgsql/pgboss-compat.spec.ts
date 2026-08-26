import 'reflect-metadata';
import { QueryRunner } from 'typeorm';
import { hasPgbossArchive } from './pgboss-compat';

describe('hasPgbossArchive', () => {
  let queryRunner: QueryRunner;

  beforeEach(() => {
    queryRunner = {
      query: jest.fn(),
    } as unknown as QueryRunner;
  });

  it('returns true when pgboss.archive exists', async () => {
    (queryRunner.query as jest.Mock).mockResolvedValue([{ hasArchive: true }]);

    const result = await hasPgbossArchive(queryRunner);

    expect(result).toBe(true);
  });

  it('returns false when pgboss.archive does not exist', async () => {
    (queryRunner.query as jest.Mock).mockResolvedValue([{ hasArchive: false }]);

    const result = await hasPgbossArchive(queryRunner);

    expect(result).toBe(false);
  });

  it('calls queryRunner.query with the expected SQL probe', async () => {
    (queryRunner.query as jest.Mock).mockResolvedValue([{ hasArchive: false }]);

    await hasPgbossArchive(queryRunner);

    expect(queryRunner.query).toHaveBeenCalledTimes(1);
    expect(queryRunner.query).toHaveBeenCalledWith(
      `select to_regclass('pgboss.archive') is not null as "hasArchive"`
    );
  });

  it('returns false when the query result is empty', async () => {
    (queryRunner.query as jest.Mock).mockResolvedValue([]);

    const result = await hasPgbossArchive(queryRunner);

    expect(result).toBe(false);
  });
});
