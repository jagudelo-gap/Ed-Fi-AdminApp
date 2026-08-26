import { Global, Module } from '@nestjs/common';
import { TypeOrmModule, getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { JobQueue } from '@edanalytics/models-server';
import config from 'config';
import { PgBoss } from 'pg-boss';
import { DataSource, Repository } from 'typeorm';
import { PgBossAdapter } from './pg-boss-adapter.service';
import { MssqlJobQueueService } from './mssql-job-queue.service';

// Only import TypeORM repositories for MSSQL; avoids metadata-validation errors on
// PostgreSQL deployments where the job_queue table does not exist (D-12).
const mssqlImports = config.DB_ENGINE === 'mssql' ? [TypeOrmModule.forFeature([JobQueue])] : [];

@Global()
@Module({
  imports: [...mssqlImports],
  providers: [
    {
      provide: 'IJobQueueService',
      useFactory: (boss: PgBoss | null, jobRepo?: Repository<JobQueue>, dataSource?: DataSource) => {
        if (config.DB_ENGINE !== 'mssql') {
          return new PgBossAdapter(boss!);
        }
        return new MssqlJobQueueService(jobRepo!, dataSource!);
      },
      inject: [
        'PgBossInstance',
        ...(config.DB_ENGINE === 'mssql' ? [getRepositoryToken(JobQueue), getDataSourceToken()] : []),
      ],
    },
  ],
  exports: ['IJobQueueService'],
})
export class JobQueueModule {}
