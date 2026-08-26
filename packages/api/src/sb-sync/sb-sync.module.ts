import { Module } from '@nestjs/common';
import { SbSyncController } from './sb-sync.controller';

export const SYNC_SCHEDULER_CHNL = 'sbe-sync-scheduler';
export const ENV_SYNC_CHNL = 'sbe-sync';
export const TENANT_SYNC_CHNL = 'edfi-tenant-sync';

@Module({
  controllers: [SbSyncController],
})
export class SbSyncModule {}
