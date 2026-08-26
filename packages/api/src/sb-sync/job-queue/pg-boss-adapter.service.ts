import { Injectable, NotFoundException, OnApplicationShutdown } from '@nestjs/common';
import { PgBoss } from 'pg-boss';
import { IJobQueueService, Job, JobOptions, ScheduleOptions } from './job-queue.interface';

type PgBossMetadataJob<T = object> = {
  id: string;
  name: string;
  data: T;
  state: Job['state'];
  createdOn: Date;
  startedOn?: Date;
  completedOn?: Date | null;
  output?: unknown;
  retryCount?: number;
};

@Injectable()
export class PgBossAdapter implements IJobQueueService, OnApplicationShutdown {
  private readonly queueNamesByJobId = new Map<string, string>();

  constructor(private readonly boss: PgBoss) {}

  async start(): Promise<void> {
    await this.boss.start();
  }

  async stop(options?: { graceful?: boolean; destroy?: boolean }): Promise<void> {
    await this.boss.stop(options);
  }

  /** Idempotently create the named queue in pgboss.queue (required by pg-boss v12). */
  async createQueue(name: string): Promise<void> {
    await this.boss.createQueue(name);
  }

  async send<T = object>(
    queueName: string,
    data: T | null,
    options?: JobOptions
  ): Promise<string> {
    // Normalize null/undefined to an empty object — pg-boss expects an object payload.
    const payload = (data ?? {}) as object;
    const id = await this.boss.send(queueName, payload, {
      ...(options?.singletonKey !== undefined && { singletonKey: options.singletonKey }),
      ...(options?.expireInHours !== undefined && { expireInHours: options.expireInHours }),
      ...(options?.retryLimit !== undefined && { retryLimit: options.retryLimit }),
      ...(options?.retryDelay !== undefined && { retryDelay: options.retryDelay }),
      ...(options?.retryBackoff !== undefined && { retryBackoff: options.retryBackoff }),
    });

    if (id !== null) {
      this.queueNamesByJobId.set(id, queueName);
      return id;
    }

    // pg-boss returns null when a job is silently deduped (singleton/exclusive queue
    // policy, or matching singletonKey).  Attempt to resolve the real UUID so that a
    // subsequent getJobById() call has a valid map entry and a valid pg-boss id.
    const singletonKey = options?.singletonKey;
    const findOptions = singletonKey !== undefined ? { key: singletonKey } : {};
    const existing = await this.boss.findJobs(queueName, findOptions);
    if (existing.length > 0) {
      // Sort: non-terminal jobs first (they are the relevant in-flight jobs),
      // then newest createdOn first within each group.  This avoids selecting a
      // stale historical completed/failed job when a fresher in-flight one exists.
      const sorted = [...existing].sort((a, b) => {
        const aIsTerminal = PgBossAdapter.TERMINAL_STATES.has(a.state) ? 1 : 0;
        const bIsTerminal = PgBossAdapter.TERMINAL_STATES.has(b.state) ? 1 : 0;
        if (aIsTerminal !== bIsTerminal) return aIsTerminal - bIsTerminal;
        return new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime();
      });
      const best = sorted[0];
      this.queueNamesByJobId.set(best.id, queueName);
      return best.id;
    }

    // Rare race: job completed between send() and findJobs().  Store the sentinel so
    // getJobById() can at least attempt a pg-boss lookup rather than failing instantly
    // on a missing map entry.
    const sentinel = singletonKey ?? 'deduped';
    this.queueNamesByJobId.set(sentinel, queueName);
    return sentinel;
  }

  async schedule(
    queueName: string,
    cron: string,
    data: unknown,
    options?: ScheduleOptions
  ): Promise<void> {
    // Normalize null/undefined to an empty object — pg-boss expects an object payload.
    const payload = (data ?? {}) as object;
    await this.boss.schedule(queueName, cron, payload, { tz: options?.tz });
  }

  async work<T = object>(
    queueName: string,
    handler: (job: Job<T>) => Promise<unknown>
  ): Promise<void> {
    await this.boss.work<T>(
      queueName,
      { includeMetadata: true },
      async (pgJobs) => {
        for (const pgJob of pgJobs) {
          const metadataJob = pgJob as unknown as PgBossMetadataJob<T>;
          await handler({
            id: metadataJob.id,
            name: metadataJob.name,
            data: metadataJob.data,
            state: metadataJob.state,
            createdon: metadataJob.createdOn,
            startedon: metadataJob.startedOn,
            completedon: metadataJob.completedOn ?? undefined,
            output: metadataJob.output,
            retrycount: metadataJob.retryCount,
          });
        }
      }
    );
  }

  private static readonly TERMINAL_STATES = new Set<string>([
    'completed',
    'failed',
    'cancelled',
    'expired',
  ]);

  private static readonly UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  async getJobById(id: string): Promise<Job> {
    const queueName = this.queueNamesByJobId.get(id);
    if (!queueName) {
      throw new NotFoundException(`Job ${id} not found`);
    }
    // Non-UUID sentinel values must never reach pg-boss – the DB will throw a UUID
    // parse error. Treat as NotFound and evict the stale map entry.
    if (!PgBossAdapter.UUID_REGEX.test(id)) {
      this.queueNamesByJobId.delete(id);
      throw new NotFoundException(`Job ${id} not found`);
    }
    const pgJob = await this.boss.getJobById(queueName, id);
    if (!pgJob) {
      throw new NotFoundException(`Job ${id} not found`);
    }
    // Clean up map entry once the job reaches a terminal state so the map does not
    // grow without bound for the process lifetime.
    if (PgBossAdapter.TERMINAL_STATES.has(pgJob.state)) {
      this.queueNamesByJobId.delete(id);
    }
    return {
      id: pgJob.id,
      name: pgJob.name,
      data: pgJob.data as object,
      state: pgJob.state,
      createdon: pgJob.createdOn,
      startedon: pgJob.startedOn,
      completedon: pgJob.completedOn ?? undefined,
      output: pgJob.output,
      retrycount: pgJob.retryCount,
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.stop({ graceful: false, destroy: true });
  }
}
