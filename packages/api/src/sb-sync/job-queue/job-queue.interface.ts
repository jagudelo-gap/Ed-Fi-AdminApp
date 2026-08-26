export type JobState =
  | 'created'
  | 'retry'
  | 'active'
  | 'completed'
  | 'expired'
  | 'cancelled'
  | 'failed';

export interface Job<T = object> {
  id: string;
  name: string;
  data: T;
  state: JobState;
  createdon: Date;
  startedon?: Date;
  completedon?: Date;
  output?: unknown;
  retrycount?: number;
}

export interface JobOptions {
  singletonKey?: string;
  expireInHours?: number;
  retryLimit?: number;
  retryDelay?: number;
  retryBackoff?: boolean;
}

export interface ScheduleOptions {
  tz?: string;
}

export interface IJobQueueService {
  start(): Promise<void>;
  stop(options?: { graceful?: boolean; destroy?: boolean }): Promise<void>;
  /** Ensure the named queue exists before scheduling or working on it (required by pg-boss v12). */
  createQueue(name: string): Promise<void>;
  send<T = object>(queueName: string, data: T | null, options?: JobOptions): Promise<string>;
  schedule(
    queueName: string,
    cron: string,
    data: unknown,
    options?: ScheduleOptions
  ): Promise<void>;
  work<T = object>(
    queueName: string,
    handler: (job: Job<T>) => Promise<unknown>
  ): Promise<void>;
  getJobById(id: string): Promise<Job>;
}
