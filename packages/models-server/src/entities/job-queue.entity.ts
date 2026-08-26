// Note: The singletonKey filtered unique index is created via raw migration SQL (D-11).
// DO NOT add an @Index decorator for filtered/conditional indexes on MSSQL — TypeORM DDL
// generation for filtered WHERE clauses is unreliable across SQL Server versions.
// JobSchedule entity is intentionally omitted for v1.
// Scheduling is handled in-process via cron-parser inside MssqlJobQueueService (D-10).
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('job_queue')
@Index(['name', 'state'])
export class JobQueue {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'nvarchar', length: 'MAX' })
  data: string; // JSON string

  @Column({ type: 'varchar', length: 50, default: 'created' })
  state: string;

  @Column({ type: 'datetime2', nullable: true })
  createdon: Date;

  @Column({ type: 'datetime2', nullable: true })
  startedon: Date;

  @Column({ type: 'datetime2', nullable: true })
  completedon: Date;

  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  output: string; // JSON string

  @Column({ type: 'int', default: 0 })
  retrycount: number;

  @Column({ type: 'int', default: 3 })
  retrylimit: number;

  @Column({ type: 'int', nullable: true })
  retrydelay: number;

  @Column({ type: 'bit', default: false })
  retrybackoff: boolean;

  @Column({ type: 'datetime2', nullable: true })
  expirein: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  singletonKey: string;

  @Column({ type: 'datetime2', nullable: true })
  keepuntil: Date;

  // Enforces retry delay / backoff. processJobs() only claims rows where availableAt <= now. (D-06)
  @Column({ type: 'datetime2', nullable: true })
  availableAt: Date;

  // Lease expiry used for crash recovery. Stale 'active' rows with leaseUntil < now are
  // requeued by the startup sweeper before the polling loop begins. (D-02)
  @Column({ type: 'datetime2', nullable: true })
  leaseUntil: Date;
}
