/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';
import { DataSource, Repository } from 'typeorm';
import { JobQueue } from '@edanalytics/models-server';
import { MssqlJobQueueService } from './mssql-job-queue.service';

// Use huge poll intervals so the guarded loops never fire additional ticks during tests.
jest.mock('config', () => ({
  __esModule: true,
  default: {
    MSSQL_JOB_POLL_MS: 9_999_999,
    MSSQL_SCHEDULE_POLL_MS: 9_999_999,
  },
}));

// ---- helpers ----------------------------------------------------------------

function buildMockQueryRunner(lockResult: unknown = [{ returnCode: 0 }]) {
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue(lockResult),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
  };
}

function buildMockJob(overrides: Partial<JobQueue> = {}): JobQueue {
  return {
    id: 'job-001',
    name: 'test-queue',
    data: JSON.stringify({ payload: 1 }),
    state: 'created',
    createdon: new Date(),
    startedon: null as unknown as Date,
    completedon: null as unknown as Date,
    output: null as unknown as string,
    retrycount: 0,
    retrylimit: 3,
    retrydelay: 1000,
    retrybackoff: false,
    expirein: null as unknown as Date,
    singletonKey: null as unknown as string,
    keepuntil: null as unknown as Date,
    availableAt: null as unknown as Date,
    leaseUntil: null as unknown as Date,
    ...overrides,
  };
}

// ---- suite ------------------------------------------------------------------

describe('MssqlJobQueueService', () => {
  let service: MssqlJobQueueService;
  let mockJobRepository: jest.Mocked<Repository<JobQueue>>;
  let mockDataSource: { createQueryRunner: jest.Mock };

  beforeEach(() => {
    mockJobRepository = {
      query: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<Repository<JobQueue>>;

    mockDataSource = { createQueryRunner: jest.fn().mockReturnValue(buildMockQueryRunner()) };

    service = new MssqlJobQueueService(
      mockJobRepository,
      mockDataSource as unknown as DataSource
    );
  });

  afterEach(async () => {
    await service.stop();
    jest.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Stale active-job recovery (leaseUntil)
  // --------------------------------------------------------------------------

  describe('recoverStaleJobs', () => {
    it('should UPDATE active jobs whose leaseUntil has passed back to retry state', async () => {
      // TypeORM MSSQL raw UPDATE result: [resultSet, rowsAffected]
      mockJobRepository.query.mockResolvedValueOnce([{}, 3]);

      await (service as any).recoverStaleJobs();

      const [sql] = mockJobRepository.query.mock.calls[0];
      expect(sql).toContain("state = 'retry'");
      expect(sql).toContain("state = 'active'");
      expect(sql).toContain('leaseUntil < GETUTCDATE()');
    });

    it('should not throw when no stale jobs exist', async () => {
      mockJobRepository.query.mockResolvedValueOnce([{}, 0]);

      await expect((service as any).recoverStaleJobs()).resolves.toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // Atomic claim — no double-claim (processJobs)
  // --------------------------------------------------------------------------

  describe('processJobs (atomic claim)', () => {
    it('should use UPDLOCK, ROWLOCK and READPAST hints to atomically claim jobs', async () => {
      mockJobRepository.query.mockResolvedValueOnce([]); // no jobs claimed
      (service as any).isRunning = true;

      await (service as any).processJobs();

      const claimCall = mockJobRepository.query.mock.calls.find(
        ([sql]: [string]) => sql.includes('UPDLOCK')
      );
      expect(claimCall).toBeDefined();
      expect(claimCall![0]).toContain('ROWLOCK');
      expect(claimCall![0]).toContain('READPAST');
    });

    it('should only claim jobs in created or retry state that are past their availableAt', async () => {
      mockJobRepository.query.mockResolvedValueOnce([]);
      (service as any).isRunning = true;

      await (service as any).processJobs();

      const claimCall = mockJobRepository.query.mock.calls.find(
        ([sql]: [string]) => sql.includes('UPDLOCK')
      );
      expect(claimCall![0]).toContain("state IN ('created', 'retry')");
      expect(claimCall![0]).toContain('availableAt');
    });

    it('should not invoke any worker when no jobs are claimed', async () => {
      mockJobRepository.query.mockResolvedValueOnce([]); // empty claim result
      (service as any).isRunning = true;

      const handler = jest.fn();
      await service.work('test-queue', handler);
      await (service as any).processJobs();

      expect(handler).not.toHaveBeenCalled();
    });

    it('should invoke the registered worker for each claimed job', async () => {
      const job = buildMockJob();
      mockJobRepository.query.mockResolvedValue([]); // subsequent UPDATE calls (complete)

      const handler = jest.fn().mockResolvedValue(undefined);
      await service.work('test-queue', handler);

      // Test executeJob directly — processJobs is fire-and-forget for each job
      await (service as any).executeJob(job);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: job.id }));
    });
  });

  // --------------------------------------------------------------------------
  // Retry delay enforcement (availableAt)
  // --------------------------------------------------------------------------

  describe('executeJob (retry delay)', () => {
    it('should set state=retry with the configured retrydelay as availableAt offset', async () => {
      const job = buildMockJob({ retrycount: 0, retrylimit: 3, retrydelay: 5000, retrybackoff: false });
      mockJobRepository.query.mockResolvedValue([]);
      await service.work('test-queue', async () => { throw new Error('fail'); });

      await (service as any).executeJob(job);

      const retryCall = mockJobRepository.query.mock.calls.find(
        ([sql]: [string]) => sql.includes("state='retry'")
      );
      expect(retryCall).toBeDefined();
      // param index 3 is nextRetryMs — should equal retrydelay (no backoff)
      expect(retryCall![1][3]).toBe(5000);
      expect(retryCall![0]).toContain('DATEADD(MILLISECOND');
    });

    it('should use exponential backoff when retrybackoff is enabled', async () => {
      // retrycount=2, retrydelay=1000, backoff → 2^2 * 1000 = 4000 ms
      const job = buildMockJob({ retrycount: 2, retrylimit: 5, retrydelay: 1000, retrybackoff: true });
      mockJobRepository.query.mockResolvedValue([]);
      await service.work('test-queue', async () => { throw new Error('fail'); });

      await (service as any).executeJob(job);

      const retryCall = mockJobRepository.query.mock.calls.find(
        ([sql]: [string]) => sql.includes("state='retry'")
      );
      expect(retryCall![1][3]).toBe(4000);
    });

    it('should increment retrycount by 1 on each retry', async () => {
      const job = buildMockJob({ retrycount: 1, retrylimit: 3 });
      mockJobRepository.query.mockResolvedValue([]);
      await service.work('test-queue', async () => { throw new Error('fail'); });

      await (service as any).executeJob(job);

      const retryCall = mockJobRepository.query.mock.calls.find(
        ([sql]: [string]) => sql.includes("state='retry'")
      );
      // param index 1 is the new retrycount
      expect(retryCall![1][1]).toBe(2);
    });

    it('should mark job as failed when retrycount reaches retrylimit', async () => {
      const job = buildMockJob({ retrycount: 3, retrylimit: 3 });
      mockJobRepository.query.mockResolvedValue([]);
      await service.work('test-queue', async () => { throw new Error('final fail'); });

      await (service as any).executeJob(job);

      const failCall = mockJobRepository.query.mock.calls.find(
        ([sql]: [string]) => sql.includes("state='failed'")
      );
      expect(failCall).toBeDefined();
      // no retry call
      const retryCall = mockJobRepository.query.mock.calls.find(
        ([sql]: [string]) => sql.includes("state='retry'")
      );
      expect(retryCall).toBeUndefined();
    });

    it('should mark job as completed when handler succeeds', async () => {
      const job = buildMockJob();
      mockJobRepository.query.mockResolvedValue([]);
      await service.work('test-queue', jest.fn().mockResolvedValue(undefined));

      await (service as any).executeJob(job);

      const completeCall = mockJobRepository.query.mock.calls.find(
        ([sql]: [string]) => sql.includes("state='completed'")
      );
      expect(completeCall).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Scheduler leader-lock (withSchedulerLock)
  // --------------------------------------------------------------------------

  describe('withSchedulerLock (leader-lock)', () => {
    it('should execute fn when sp_getapplock returns 0 (lock acquired)', async () => {
      const qr = buildMockQueryRunner([{ returnCode: 0 }]);
      mockDataSource.createQueryRunner.mockReturnValue(qr);

      const fn = jest.fn().mockResolvedValue(undefined);
      await (service as any).withSchedulerLock('my-queue', fn);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(qr.commitTransaction).toHaveBeenCalled();
      expect(qr.release).toHaveBeenCalled();
    });

    it('should execute fn when sp_getapplock returns 1 (lock acquired by same owner)', async () => {
      const qr = buildMockQueryRunner([{ returnCode: 1 }]);
      mockDataSource.createQueryRunner.mockReturnValue(qr);

      const fn = jest.fn().mockResolvedValue(undefined);
      await (service as any).withSchedulerLock('my-queue', fn);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should NOT execute fn when sp_getapplock returns -1 (lock not available)', async () => {
      const qr = buildMockQueryRunner([{ returnCode: -1 }]);
      mockDataSource.createQueryRunner.mockReturnValue(qr);

      const fn = jest.fn();
      await (service as any).withSchedulerLock('my-queue', fn);

      expect(fn).not.toHaveBeenCalled();
      expect(qr.commitTransaction).toHaveBeenCalled(); // transaction still committed cleanly
      expect(qr.release).toHaveBeenCalled();
    });

    it('should use @LockOwner=Transaction so the lock is tied to the transaction', async () => {
      const qr = buildMockQueryRunner([{ returnCode: 0 }]);
      mockDataSource.createQueryRunner.mockReturnValue(qr);

      await (service as any).withSchedulerLock('my-queue', jest.fn().mockResolvedValue(undefined));

      const [sql] = qr.query.mock.calls[0];
      expect(sql).toContain("@LockOwner = 'Transaction'");
    });

    it('should rollback and release if fn throws, then rethrow the error', async () => {
      const qr = buildMockQueryRunner([{ returnCode: 0 }]);
      mockDataSource.createQueryRunner.mockReturnValue(qr);

      const fn = jest.fn().mockRejectedValue(new Error('handler boom'));

      await expect((service as any).withSchedulerLock('my-queue', fn)).rejects.toThrow('handler boom');

      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(qr.commitTransaction).not.toHaveBeenCalled();
      expect(qr.release).toHaveBeenCalled();
    });

    it('should use a dedicated QueryRunner (not the shared repository connection)', async () => {
      const qr = buildMockQueryRunner([{ returnCode: 0 }]);
      mockDataSource.createQueryRunner.mockReturnValue(qr);

      await (service as any).withSchedulerLock('my-queue', jest.fn().mockResolvedValue(undefined));

      // The lock query must go through the dedicated QueryRunner, not jobRepository
      expect(qr.query).toHaveBeenCalled();
      expect(mockJobRepository.query).not.toHaveBeenCalled();
    });
  });
});
