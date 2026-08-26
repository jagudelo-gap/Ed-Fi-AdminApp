import { Module } from '@nestjs/common';
import { AdminApiControllerV3 } from './admin-api.v3.controller';

@Module({
  controllers: [AdminApiControllerV3],
})
export class AdminApiModuleV3 {}
