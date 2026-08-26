import { MigrationInterface, QueryRunner } from 'typeorm';

export class JobQueueAndSyncView1764929283532 implements MigrationInterface {
  name = 'JobQueueAndSyncView1764929283532';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the dummy placeholder sb_sync_queue view created in v7-changes (D-05)
    await queryRunner.query(`DROP VIEW IF EXISTS [sb_sync_queue]`);
    await queryRunner.query(
      `DELETE FROM [typeorm_metadata] WHERE [type] IN ('VIEW', 'MATERIALIZED_VIEW') AND [name] = 'sb_sync_queue'`
    );

    // Create job_queue table with all required columns (T2-01, D-02, D-06)
    await queryRunner.query(`
      CREATE TABLE [job_queue] (
        [id]           uniqueidentifier   NOT NULL,
        [name]         varchar(255)       NOT NULL,
        [data]         nvarchar(MAX)      NOT NULL,
        [state]        varchar(50)        NOT NULL DEFAULT 'created',
        [createdon]    datetime2          NULL,
        [startedon]    datetime2          NULL,
        [completedon]  datetime2          NULL,
        [output]       nvarchar(MAX)      NULL,
        [retrycount]   int                NOT NULL DEFAULT 0,
        [retrylimit]   int                NOT NULL DEFAULT 3,
        [retrydelay]   int                NULL,
        [retrybackoff] bit                NOT NULL DEFAULT 0,
        [expirein]     datetime2          NULL,
        [singletonKey] varchar(255)       NULL,
        [keepuntil]    datetime2          NULL,
        [availableAt]  datetime2          NULL,
        [leaseUntil]   datetime2          NULL,
        CONSTRAINT [PK_job_queue] PRIMARY KEY ([id])
      )
    `);

    // Composite index for polling queries (T2-01)
    await queryRunner.query(
      `CREATE INDEX [IX_job_queue_name_state] ON [job_queue] ([name], [state])`
    );

    // Filtered unique index for singleton deduplication (D-11)
    // Cannot use @Index decorator for filtered WHERE clauses on MSSQL
    await queryRunner.query(`
      CREATE UNIQUE INDEX [UX_job_queue_singletonKey_active]
      ON [job_queue] ([singletonKey])
      WHERE [singletonKey] IS NOT NULL
        AND [state] IN ('created', 'retry', 'active')
    `);

    // Create real sb_sync_queue view backed by job_queue (D-05, Section 5 of README)
    await queryRunner.query(`
      CREATE VIEW [sb_sync_queue] AS
      SELECT
        jq.[id],
        CASE WHEN jq.[name] = 'sbe-sync' THEN 'SbEnvironment' ELSE 'EdfiTenant' END AS [type],
        COALESCE(sbe.[name], et.[name], 'resource no longer exists')               AS [name],
        COALESCE(sbe.[id], et.[sbEnvironmentId])                                   AS [sbEnvironmentId],
        et.[id]                                                                    AS [edfiTenantId],
        jq.[data]                                                                  AS [dataText],
        jq.[data],
        jq.[state],
        jq.[createdon],
        jq.[completedon],
        jq.[output],
        CASE
          WHEN JSON_VALUE(jq.[output], '$.hasChanges') = 'true'  THEN CAST(1 AS BIT)
          ELSE CAST(0 AS BIT)
        END                                                                        AS [hasChanges]
      FROM [job_queue] jq
      LEFT JOIN [sb_environment] sbe ON JSON_VALUE(jq.[data], '$.sbEnvironmentId') = CAST(sbe.[id] AS NVARCHAR)
      LEFT JOIN [edfi_tenant]    et  ON JSON_VALUE(jq.[data], '$.edfiTenantId')    = CAST(et.[id]  AS NVARCHAR)
      WHERE jq.[name] IN ('sbe-sync', 'edfi-tenant-sync')
    `);

    await queryRunner.query(
      `INSERT INTO [typeorm_metadata] ([schema], [type], [name], [value]) VALUES (@0, @1, @2, @3)`,
      [
        'public',
        'VIEW',
        'sb_sync_queue',
        `SELECT jq.[id], CASE WHEN jq.[name] = 'sbe-sync' THEN 'SbEnvironment' ELSE 'EdfiTenant' END AS [type], COALESCE(sbe.[name], et.[name], 'resource no longer exists') AS [name], COALESCE(sbe.[id], et.[sbEnvironmentId]) AS [sbEnvironmentId], et.[id] AS [edfiTenantId], jq.[data] AS [dataText], jq.[data], jq.[state], jq.[createdon], jq.[completedon], jq.[output], CASE WHEN JSON_VALUE(jq.[output], '$.hasChanges') = 'true' THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS [hasChanges] FROM [job_queue] jq LEFT JOIN [sb_environment] sbe ON JSON_VALUE(jq.[data], '$.sbEnvironmentId') = CAST(sbe.[id] AS NVARCHAR) LEFT JOIN [edfi_tenant] et ON JSON_VALUE(jq.[data], '$.edfiTenantId') = CAST(et.[id] AS NVARCHAR) WHERE jq.[name] IN ('sbe-sync', 'edfi-tenant-sync')`,
      ]
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM [typeorm_metadata] WHERE [type] = 'VIEW' AND [name] = 'sb_sync_queue'`
    );
    await queryRunner.query(`DROP VIEW IF EXISTS [sb_sync_queue]`);

    await queryRunner.query(`DROP INDEX IF EXISTS [UX_job_queue_singletonKey_active] ON [job_queue]`);
    await queryRunner.query(`DROP INDEX IF EXISTS [IX_job_queue_name_state] ON [job_queue]`);
    await queryRunner.query(`DROP TABLE IF EXISTS [job_queue]`);

    // Restore dummy placeholder view
    await queryRunner.query(
      `CREATE VIEW [sb_sync_queue] AS
       SELECT 1 as [id], '1' as [type], '1' as [name], 1 as [sbEnvironmentId], 1 as [edfiTenantId],
              '' as [dataText], '' as [data], '' as [state],
              '1900-01-01 00:00:00' as [createdon], '1900-01-02 00:00:00' as [completedon],
              '' as output, 0 as hasChanges
       FROM sys.views
       WHERE 1=0`
    );
    await queryRunner.query(
      `INSERT INTO [typeorm_metadata] ([schema], [type], [name], [value]) VALUES (@0, @1, @2, @3)`,
      [
        'public',
        'MATERIALIZED_VIEW',
        'sb_sync_queue',
        `SELECT 1 as [id], '1' as [type], '1' as [name], 1 as [sbEnvironmentId], 1 as [edfiTenantId], '' as [dataText], '' as [data], '' as [state], '1900-01-01 00:00:00' as [createdon], '1900-01-02 00:00:00' as [completedon], '' as output, 0 as hasChanges FROM sys.views WHERE 1=0`,
      ]
    );
  }
}
