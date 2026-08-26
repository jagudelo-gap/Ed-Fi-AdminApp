import 'reflect-metadata';
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates a mock QueryRunner suitable for migration smoke tests.
 * No actual SQL is executed.
 */
export function createMockQueryRunner(): QueryRunner {
  return {
    query: jest.fn().mockResolvedValue([{}]),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    connect: jest.fn().mockResolvedValue(undefined),
  } as unknown as QueryRunner;
}

/**
 * Runs structural smoke tests on a migration class.
 * Verifies that up() and down() both return Promises.
 *
 * @param MigrationClass - The migration class to test (must implement MigrationInterface)
 */
export function runMigrationSmokeTest(MigrationClass: new () => MigrationInterface): void {
  describe(`${MigrationClass.name}`, () => {
    let migration: MigrationInterface;
    let queryRunner: QueryRunner;

    beforeEach(() => {
      migration = new MigrationClass();
      queryRunner = createMockQueryRunner();
    });

    it('up() returns a Promise', async () => {
      const result = migration.up(queryRunner);
      expect(result).toBeInstanceOf(Promise);
      await result;
    });

    it('down() returns a Promise (if implemented)', async () => {
      if (typeof migration.down !== 'function') {
        return;
      }
      const result = migration.down(queryRunner);
      expect(result).toBeInstanceOf(Promise);
      await result.catch(() => undefined);
    });
  });
}
