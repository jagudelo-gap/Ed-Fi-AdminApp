import { Injectable } from '@nestjs/common';
import { V1AdminApiVersionStrategy } from './v1-admin-api-version.strategy';
import { V2AdminApiVersionStrategy } from './v2-admin-api-version.strategy';
import { V3AdminApiVersionStrategy } from './v3-admin-api-version.strategy';
import { AdminApiVersionStrategy } from './admin-api-version-strategy.interface';

@Injectable()
export class AdminApiVersionStrategyFactory {
  constructor(
    private readonly v1Strategy: V1AdminApiVersionStrategy,
    private readonly v2Strategy: V2AdminApiVersionStrategy,
    private readonly v3Strategy: V3AdminApiVersionStrategy
  ) {}

  getStrategy(version: string | undefined): AdminApiVersionStrategy {
    switch (version) {
      case 'v1':
        return this.v1Strategy;
      case 'v2':
        return this.v2Strategy;
      case 'v3':
        return this.v3Strategy;
      default:
        throw new Error(`Invalid API version: ${version}`);
    }
  }
}
