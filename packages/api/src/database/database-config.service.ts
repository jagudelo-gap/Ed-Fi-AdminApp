import { Injectable, Logger } from '@nestjs/common';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as config from 'config';
import { asBool } from '../utils';
import typeormConfig from './typeorm.config';

@Injectable()
export class DatabaseConfigService {
  private readonly logger = new Logger(DatabaseConfigService.name);

  async createTypeOrmOptions(): Promise<TypeOrmModuleOptions> {
    try {
      const connectionString = await config.DB_CONNECTION_STRING;
      // Make retry configuration configurable via config files (local.js) with safe defaults
      const retryAttempts = config.TYPEORM_RETRY_ATTEMPTS;
      const retryDelay = config.TYPEORM_RETRY_DELAY;

      this.logger.log(
        `TypeORM configured with ${retryAttempts} retry attempts and ${retryDelay}ms delay`
      );

      return {
        ...typeormConfig,
        url: connectionString,
        logging: config.TYPEORM_LOGGING ? JSON.parse(config.TYPEORM_LOGGING) : undefined,
        autoLoadEntities: true,
        retryAttempts,
        retryDelay,
        extra: {
          trustServerCertificate: asBool(config.DB_TRUST_CERTIFICATE),
          encrypt: asBool(config.DB_SSL),
        },
      };
    } catch (error) {
      this.logger.error(`Database configuration failed: ${error.message}`);
      throw error;
    }
  }
}
