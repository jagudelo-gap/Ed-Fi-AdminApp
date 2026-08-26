import { ServiceUnavailableException } from '@nestjs/common';
import { IJobQueueService, Job, JobOptions, ScheduleOptions } from './job-queue.interface';

const NOT_IMPLEMENTED_MESSAGE =
  'Job queue is not available for MSSQL deployments in this release. ' +
  'MSSQL support is planned for Phase 2.';

/**
 * Placeholder IJobQueueService for MSSQL deployments (Phase 1).
 * All methods throw ServiceUnavailableException so callers fail fast with a
 * clear error instead of a null-dereference crash.
 */
export class NotImplementedJobQueueService implements IJobQueueService {
  private fail(): never {
    throw new ServiceUnavailableException(NOT_IMPLEMENTED_MESSAGE);
  }

  start(): Promise<void> {
    return this.fail();
  }

  stop(): Promise<void> {
    return this.fail();
  }

  createQueue(_name: string): Promise<void> {
    return this.fail();
  }

  send<T = object>(_queueName: string, _data: T | null, _options?: JobOptions): Promise<string> {
    return this.fail();
  }

  schedule(
    _queueName: string,
    _cron: string,
    _data: unknown,
    _options?: ScheduleOptions
  ): Promise<void> {
    return this.fail();
  }

  work<T = object>(
    _queueName: string,
    _handler: (job: Job<T>) => Promise<unknown>
  ): Promise<void> {
    return this.fail();
  }

  getJobById(_id: string): Promise<Job> {
    return this.fail();
  }
}
