import { ISbSyncQueue, PgBossJobState } from '@edanalytics/models';
import { Column, Entity, Index } from 'typeorm';

// 'simple-json' is a TypeORM virtual type accepted by both PostgreSQL and MSSQL validators.
// TypeORM auto-parses string values (MSSQL nvarchar) and passes through objects as-is (PostgreSQL JSONB).
@Index('sb_sync_queue_tsvector', {
  synchronize: false,
})
@Entity('sb_sync_queue')
export class SbSyncQueue implements ISbSyncQueue {
  @Column({ primary: true })
  id: string;
  @Column()
  type: 'SbEnvironment' | 'EdfiTenant';
  @Column()
  name: string | 'resource no longer exists';
  @Column({ nullable: true })
  sbEnvironmentId: number | null;
  @Column({ nullable: true })
  edfiTenantId: number | null;
  @Column()
  dataText: string;
  @Column({ type: 'simple-json', nullable: true })
  data: { sbEnvironmentId: number } | { edfiTenantId: number };
  @Column()
  state: PgBossJobState;
  @Column({ nullable: true })
  createdon: Date;
  @Column({ nullable: true })
  completedon: Date;
  @Column({ type: 'simple-json', nullable: true })
  output: object;
  @Column({ nullable: true })
  hasChanges: boolean | null | undefined;
}
