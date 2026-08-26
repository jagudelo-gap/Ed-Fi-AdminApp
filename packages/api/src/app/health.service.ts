import { Injectable, Logger } from '@nestjs/common';
import { AggregateErrorHandler } from './aggregate-error-handler';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  checks: {
    api: {
      status: 'healthy' | 'unhealthy';
      message?: string;
    };
    database: {
      status: 'healthy' | 'unhealthy';
      message?: string;
    };
  };
}

@Injectable()
export class HealthService {

  async getHealth(): Promise<HealthStatus> {
    const timestamp = new Date().toISOString();

    // Check API health (always healthy if we can respond)
    const apiHealth = {
      status: 'healthy' as const,
      message: 'API is responding'
    };

    // Check database health with timeout - completely independent approach
    let databaseHealth: { status: 'healthy' | 'unhealthy'; message?: string };

    try {
      // Use a completely independent database check
      const isAvailable = await this.checkDatabaseIndependently();

      databaseHealth = {
        status: isAvailable ? 'healthy' : 'unhealthy',
        message: isAvailable
          ? 'Database connection successful'
          : 'Database connection failed'
      };

    } catch (error) {
      // Handle all types of database errors including AggregateError using our handler
      const errorAnalysis = AggregateErrorHandler.handle(error);

      Logger.warn(`Health check database error: ${errorAnalysis.safeMessage}`);

      // Log detailed AggregateError information for debugging
      if (AggregateErrorHandler.isAggregateError(error)) {
        const allMessages = AggregateErrorHandler.extractAllMessages(error);
        Logger.debug(`AggregateError individual messages: ${allMessages.join(', ')}`);
      }

      databaseHealth = {
        status: 'unhealthy',
        message: `Database unavailable: ${errorAnalysis.safeMessage}`
      };
    }

    const overallStatus = apiHealth.status === 'healthy' && databaseHealth.status === 'healthy'
      ? 'healthy'
      : 'unhealthy';

    return {
      status: overallStatus,
      timestamp,
      checks: {
        api: apiHealth,
        database: databaseHealth
      }
    };
  }

  private async checkDatabaseIndependently(): Promise<boolean> {
    try {
      // Add timeout to prevent hanging
      const healthCheckTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Database health check timeout')), 3000);
      });

      const healthCheckPromise = this.performDirectDatabaseCheck();

      return await Promise.race([healthCheckPromise, healthCheckTimeout]);

    } catch (_error) {
      return false;
    }
  }

  private async performDirectDatabaseCheck(): Promise<boolean> {
    let client: import('pg').Client | null = null;
    try {
      const { Client } = await import('pg');
      const config = await import('config');
      const connectionString = await config.default.DB_CONNECTION_STRING;

      client = new Client({
        connectionString,
        connectionTimeoutMillis: 2000,
        // Add additional isolation
        statement_timeout: 2000,
        query_timeout: 2000,
        application_name: 'health-check-isolated'
      });

      // Add error handlers to prevent unhandled errors
      client.on('error', () => {
        // Silently handle client errors during health check
      });

      await client.connect();
      await client.query('SELECT 1');
      return true;
    } catch (error) {
      Logger.debug(`Database health check failed: ${error.message}`);
      return false;
    } finally {
      // Ensure cleanup in finally block
      if (client) {
        try {
          await client.end();
        } catch (_cleanupError) {
          // Ignore cleanup errors
          Logger.debug('Health check client cleanup error (ignored)');
        }
      }
    }
  }
}
