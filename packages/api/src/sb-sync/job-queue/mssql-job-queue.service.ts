import { parseExpression } from 'cron-parser'; // pinned to ^3.1.0 (D-13)
import { Injectable, Logger, NotFoundException, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, In, Repository } from 'typeorm';
import config from 'config';
import { JobQueue } from '@edanalytics/models-server';
import { IJobQueueService, Job, JobOptions, ScheduleOptions } from './job-queue.interface';

@Injectable()
export class MssqlJobQueueService
  implements IJobQueueService, OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(MssqlJobQueueService.name);
  private workers = new Map<string, (job: Job) => Promise<unknown>>();
  // In-process schedule registry — no DB table (D-10)
  private scheduleRegistry = new Map<string, { cron: string; data: unknown; tz: string }>();
  private lastScheduleFire = new Map<string, Date>();
  private pollingTimer: NodeJS.Timeout | undefined;
  private scheduleTimer: NodeJS.Timeout | undefined;
  private isRunning = false;
  private lastDiagnosticLog = 0; // timestamp of last diagnostic log to avoid spam
  private readonly pollIntervalMs: number;
  private readonly scheduleIntervalMs: number;

  constructor(
    @InjectRepository(JobQueue)
    private readonly jobRepository: Repository<JobQueue>,
    @InjectDataSource()
    private readonly dataSource: DataSource
  ) {
    this.pollIntervalMs = config.MSSQL_JOB_POLL_MS ?? 1000;
    this.scheduleIntervalMs = config.MSSQL_SCHEDULE_POLL_MS ?? 10000;
  }

  async start(): Promise<void> {
    if (this.isRunning) return; // idempotent — safe to call from both onModuleInit and onApplicationBootstrap
    this.isRunning = true;
    await this.recoverStaleJobs();
    void this.runJobLoop();
    void this.runScheduleLoop();
    this.logger.log('MSSQL Job Queue started');
  }

  async stop(options?: { graceful?: boolean; destroy?: boolean }): Promise<void> {
    this.isRunning = false;
    if (this.pollingTimer) clearTimeout(this.pollingTimer);
    if (this.scheduleTimer) clearTimeout(this.scheduleTimer);

    if (options?.graceful) {
      const timeout = 30_000;
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const activeCount = await this.jobRepository.count({ where: { state: 'active' } });
        if (activeCount === 0) break;
        await new Promise<void>((resolve) => setTimeout(resolve, 500));
      }
    }
    this.logger.log('MSSQL Job Queue stopped');
  }

  async send<T = object>(queueName: string, data: T | null, options?: JobOptions): Promise<string> {
    const id = randomUUID();
    const jobData = JSON.stringify(data ?? {});
    const singletonKey = options?.singletonKey ?? null;
    const retrylimit = options?.retryLimit ?? 3;
    const retrydelay = options?.retryDelay ?? 0;
    const retrybackoff = (options?.retryBackoff ?? false) ? 1 : 0;

    try {
      if (options?.expireInHours != null) {
        // Use server-side DATEADD so expirein uses the same clock as GETUTCDATE() comparisons.
        // Node.js Date.now() and the SQL Server clock can differ; using SQL functions eliminates
        // the mismatch entirely.
        await this.jobRepository.query(
          `INSERT INTO job_queue
             (id, name, data, state, createdon, singletonKey, retrylimit, retrydelay, retrybackoff, expirein)
           VALUES
             (@0, @1, @2, 'created', GETUTCDATE(), @3, @4, @5, @6, DATEADD(HOUR, @7, GETUTCDATE()))`,
          [id, queueName, jobData, singletonKey, retrylimit, retrydelay, retrybackoff, options.expireInHours]
        );
      } else {
        await this.jobRepository.query(
          `INSERT INTO job_queue
             (id, name, data, state, createdon, singletonKey, retrylimit, retrydelay, retrybackoff)
           VALUES
             (@0, @1, @2, 'created', GETUTCDATE(), @3, @4, @5, @6)`,
          [id, queueName, jobData, singletonKey, retrylimit, retrydelay, retrybackoff]
        );
      }
      this.logger.log(`Job ${id} queued for ${queueName}`);
      return id;
    } catch (error) {
      // MSSQL unique constraint violation codes: 2601 (duplicate key row) or 2627 (unique constraint)
      const code = (error as { number?: number })?.number;
      if (code === 2601 || code === 2627) {
        this.logger.warn(`Duplicate job prevented for singleton key: ${options?.singletonKey}`);
        // Constrain by active states to avoid returning a stale completed/failed row (D-08)
        const existing = await this.jobRepository.findOne({
          where: {
            singletonKey: options?.singletonKey,
            state: In(['created', 'retry', 'active']),
          },
        });
        return existing?.id ?? id;
      }
      throw error;
    }
  }

  // Registers an in-process cron schedule — no DB persistence needed for v1 (D-10)
  /** No-op for MSSQL: queue existence is implicit in the job_queue table (no separate queue registry). */
  async createQueue(_name: string): Promise<void> {
    // MSSQL job queue uses a flat job_queue table; no explicit queue creation step needed.
  }

  async schedule(
    queueName: string,
    cron: string,
    data: unknown,
    options?: ScheduleOptions
  ): Promise<void> {
    this.scheduleRegistry.set(queueName, { cron, data, tz: options?.tz ?? 'UTC' });
    this.logger.log(`Cron schedule registered in-process for queue: ${queueName} (${cron})`);
  }

  async work<T = object>(
    queueName: string,
    handler: (job: Job<T>) => Promise<unknown>
  ): Promise<void> {
    this.workers.set(queueName, handler as (job: Job) => Promise<unknown>);
    this.logger.log(`Worker registered for queue: ${queueName}`);
  }

  async getJobById(id: string): Promise<Job> {
    const job = await this.jobRepository.findOne({ where: { id } });
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    return {
      id: job.id,
      name: job.name,
      data: job.data ? JSON.parse(job.data) : {},
      state: job.state as Job['state'],
      createdon: job.createdon,
      startedon: job.startedon ?? undefined,
      completedon: job.completedon ?? undefined,
      output: job.output ? JSON.parse(job.output) : undefined,
      retrycount: job.retrycount,
    };
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.start();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.stop({ graceful: true });
  }

  // ---- Private methods ----

  // Guarded loop — next tick only starts after the current one finishes (D-09)
  private async runJobLoop(): Promise<void> {
    if (!this.isRunning) return;
    try {
      await this.processJobs();
    } catch (err) {
      this.logger.error(`processJobs error: ${(err as Error).message}`, (err as Error).stack);
    } finally {
      if (this.isRunning) {
        this.pollingTimer = setTimeout(() => void this.runJobLoop(), this.pollIntervalMs);
      }
    }
  }

  // Guarded loop — prevents overlapping schedule checks (D-09)
  private async runScheduleLoop(): Promise<void> {
    if (!this.isRunning) return;
    try {
      await this.processSchedules();
    } catch (err) {
      this.logger.error(`processSchedules error: ${(err as Error).message}`, (err as Error).stack);
    } finally {
      if (this.isRunning) {
        this.scheduleTimer = setTimeout(() => void this.runScheduleLoop(), this.scheduleIntervalMs);
      }
    }
  }

  // Atomically claim up to 10 eligible jobs using MSSQL locking hints (D-01)
  private async processJobs(): Promise<void> {
    if (!this.isRunning) return;

    const leaseMinutes = 5;

    // Use GETUTCDATE() + server-side DATEADD for leaseUntil so it uses the same clock
    // as the expirein/availableAt comparisons — avoids Node.js vs SQL Server clock skew.
    const claimed: JobQueue[] = await this.jobRepository.query(
      `UPDATE TOP (10) job_queue WITH (UPDLOCK, ROWLOCK, READPAST)
       SET state      = 'active',
           startedon  = GETUTCDATE(),
           leaseUntil = DATEADD(MINUTE, ${leaseMinutes}, GETUTCDATE())
       OUTPUT INSERTED.*
       WHERE state IN ('created', 'retry')
         AND (availableAt IS NULL OR availableAt <= GETUTCDATE())
         AND (expirein    IS NULL OR expirein    >  GETUTCDATE())`,
      []
    );

    for (const job of claimed) {
      this.logger.log(`Claimed job ${job.id} (${job.name}) — running handler`);
      // fire-and-forget — each job runs independently without blocking the next poll tick
      void this.executeJob(job);
    }

    if (claimed.length === 0) {
      // Throttled diagnostic: show actual DB values vs GETDATE() once every 10s
      const now = Date.now();
      if (now - this.lastDiagnosticLog > 10_000) {
        this.lastDiagnosticLog = now;
        const diagnostic: Array<{
          id: string;
          name: string;
          state: string;
          availableAt: Date | null;
          expirein: Date | null;
          serverNow: Date;
          availableOk: number;
          expireOk: number;
        }> = await this.jobRepository.query(`
          SELECT TOP 5
            id, name, state, availableAt, expirein,
            GETUTCDATE() as serverNow,
            CASE WHEN availableAt IS NULL OR availableAt <= GETUTCDATE() THEN 1 ELSE 0 END as availableOk,
            CASE WHEN expirein    IS NULL OR expirein    >  GETUTCDATE() THEN 1 ELSE 0 END as expireOk
          FROM job_queue
          WHERE state IN ('created', 'retry')
        `);
        if (diagnostic.length > 0) {
          for (const row of diagnostic) {
            this.logger.warn(
              `Unclaimed job ${row.id} (${row.name}): state=${row.state}, ` +
                `availableAt=${row.availableAt?.toISOString() ?? 'null'} (ok=${row.availableOk}), ` +
                `expirein=${row.expirein?.toISOString() ?? 'null'} (ok=${row.expireOk}), ` +
                `serverNow=${row.serverNow?.toISOString()}`
            );
          }
        }
      }
    }
  }

  private async executeJob(job: JobQueue): Promise<void> {
    const handler = this.workers.get(job.name);
    if (!handler) {
      this.logger.warn(`No worker registered for queue: ${job.name} — marking job ${job.id} as failed`);
      await this.jobRepository.query(
        `UPDATE job_queue SET state='failed', completedon=GETUTCDATE(), output=@1 WHERE id=@0`,
        [job.id, JSON.stringify({ error: `No worker registered for queue: ${job.name}` })]
      );
      return;
    }

    try {
      const jobData: Job = {
        id: job.id,
        name: job.name,
        data: job.data ? JSON.parse(job.data) : {},
        state: 'active',
        createdon: job.createdon,
        startedon: job.startedon ?? new Date(),
        completedon: job.completedon ?? undefined,
        output: job.output ? JSON.parse(job.output) : undefined,
        retrycount: job.retrycount,
      };

      await handler(jobData);

      await this.jobRepository.query(
        `UPDATE job_queue SET state='completed', completedon=GETUTCDATE() WHERE id=@0`,
        [job.id]
      );

      this.logger.log(`Job ${job.id} completed successfully`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Job ${job.id} failed: ${err.message}`, err.stack);

      if (job.retrycount < job.retrylimit) {
        const nextRetryMs = job.retrybackoff
          ? Math.pow(2, job.retrycount) * (job.retrydelay || 1000)
          : job.retrydelay || 1000;

        // Use server-side DATEADD for availableAt to avoid Node.js vs SQL Server clock skew (D-06)
        await this.jobRepository.query(
          `UPDATE job_queue SET state='retry', retrycount=@1, output=@2,
             availableAt=DATEADD(MILLISECOND, @3, GETUTCDATE())
           WHERE id=@0`,
          [job.id, job.retrycount + 1, JSON.stringify({ error: err.message, stack: err.stack }), nextRetryMs]
        );

        this.logger.log(`Job ${job.id} will retry in ${nextRetryMs}ms`);
      } else {
        await this.jobRepository.query(
          `UPDATE job_queue SET state='failed', completedon=GETUTCDATE(), output=@1 WHERE id=@0`,
          [job.id, JSON.stringify({ error: err.message, stack: err.stack })]
        );
      }
    }
  }

  // In-process cron scheduler; reads registry populated by schedule() (D-10)
  // Uses sp_getapplock to prevent multi-instance duplicate fires (D-07)
  private async processSchedules(): Promise<void> {
    if (!this.isRunning || this.scheduleRegistry.size === 0) return;

    const now = new Date();

    for (const [queueName, entry] of this.scheduleRegistry.entries()) {
      const lastFire = this.lastScheduleFire.get(queueName);
      const nextFire = lastFire
        ? this.calculateNextRun(entry.cron, entry.tz, lastFire)
        : new Date(0); // fire immediately on first tick if no prior record

      if (nextFire <= now) {
        await this.withSchedulerLock(queueName, async () => {
          await this.send(queueName, entry.data ?? null);
          this.lastScheduleFire.set(queueName, now);
        });
      }
    }
  }

  private calculateNextRun(cron: string, timezone?: string, fromDate?: Date): Date {
    const interval = parseExpression(cron, {
      currentDate: fromDate ?? new Date(),
      tz: timezone ?? 'UTC',
    });
    return interval.next().toDate();
  }

  // Startup sweeper: requeue any 'active' jobs whose lease expired (crash recovery) (D-02)
  private async recoverStaleJobs(): Promise<void> {
    const result = await this.jobRepository.query(`
      UPDATE job_queue
      SET state = 'retry', retrycount = retrycount + 1
      WHERE state = 'active' AND leaseUntil < GETUTCDATE()
    `);
    // TypeORM raw query result for UPDATE on MSSQL: array with rowsAffected
    const recovered: number = Array.isArray(result) ? (result[1] ?? 0) : 0;
    if (recovered > 0) {
      this.logger.warn(`Recovered ${recovered} stale active job(s) on startup`);
    }
  }

  // Advisory lock via sp_getapplock with @LockOwner='Transaction' (D-07).
  // A dedicated QueryRunner ensures acquire, work, and implicit release all happen on the
  // same SQL Server session. The lock is released automatically when the transaction ends,
  // so there is no risk of leaving a stale lock on a pooled connection.
  private async withSchedulerLock(name: string, fn: () => Promise<void>): Promise<void> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const result: Array<{ returnCode: number }> = await qr.query(
        `DECLARE @ret INT;
         EXEC @ret = sp_getapplock @Resource = @0, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 0;
         SELECT @ret AS returnCode;`,
        [`scheduler_${name}`]
      );
      const returnCode: number = Array.isArray(result) && result[0] ? result[0].returnCode : -1;
      if (returnCode >= 0) {
        await fn();
      }
      await qr.commitTransaction();
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }
}
