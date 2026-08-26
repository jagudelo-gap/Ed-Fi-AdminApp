import { LogLevel } from '@nestjs/common';

declare module 'config' {
  export interface IDbSecret {
    DB_HOST: string;
    DB_PORT: number;
    DB_USERNAME: string;
    DB_PASSWORD: string;
    DB_DATABASE: string;
  }

  export interface IDbEncryptionSecret {
    KEY: string;
    IV: string;
  }

  export interface IAuth0Secret {
    ISSUER?: string;
    MACHINE_AUDIENCE?: string;
    CLIENT_ID?: string;
    CLIENT_SECRET?: string;
  }

  interface ConfigClass {
    ENABLE_OPEN_API: boolean;
    AWS_DB_SECRET?: string | undefined;
    DB_SECRET_VALUE: never;
    /**
     * Format: `postgres://username@host:port/db?password=password&sslmode=ssl`
     */
    DB_CONNECTION_STRING: string | Promise<string>;

    /** Serialized JSON array of "query" | "schema" | "error" | "warn" | "info" | "log" | "migration" */
    TYPEORM_LOGGING: string | undefined;

    /** Number of retry attempts for TypeORM database connections */
    TYPEORM_RETRY_ATTEMPTS: number;

    /** Delay between retry attempts in milliseconds */
    TYPEORM_RETRY_DELAY: number;

    AWS_DB_ENCRYPTION_SECRET?: string | undefined;
    DB_ENCRYPTION_SECRET_VALUE: never;
    DB_ENCRYPTION_SECRET: IDbEncryptionSecret | Promise<IDbEncryptionSecret>;

    AWS_REGION?: string | undefined;
    DB_ENGINE: 'mssql' | 'pgsql';
    DB_SSL: boolean | 'true' | 'false';
    DB_TRUST_CERTIFICATE: boolean | 'true' | 'false';
    DB_TTL_IN_MINUTES: number;
    DB_RUN_MIGRATIONS: boolean;
    DB_SYNCHRONIZE: boolean;
    FE_URL: string;
    MY_URL: string;
    USE_YOPASS: boolean | 'true' | 'false';
    YOPASS_URL: string;
    API_PORT: number;
    SB_SYNC_CRON: string;
    SSL_VERIFICATION: boolean | 'true' | 'false';

    /** Max number of poll attempts before treating an EdOrg refresh job as timed out (default: 10) */
    ADMINAPI_REFRESH_POLL_ATTEMPTS: number;
    /** Milliseconds to wait between EdOrg refresh job poll attempts (default: 5000) */
    ADMINAPI_REFRESH_POLL_INTERVAL_MS: number;

    SAMPLE_OIDC_CONFIG?: {
      issuer: string;
      clientSecret: string;
      clientId: string;
      scope: string;
    };

    ADMIN_USERNAME?: string | undefined;

    CODE_ENV: string;

    // over-arching application to access auth0 management API
    AUTH0_CONFIG_SECRET: IAuth0Secret | Promise<IAuth0Secret>;

    WHITELISTED_REDIRECTS: string[];
    MY_URL_API_PATH: string;
    OPENAPI_TITLE: string;
    OPENAPI_DESCRIPTION: string;
    OPEN_API: boolean;
    EDFI_URLS_TIMEOUT_MS: number;

    /** Per-provider OIDC discovery timeout in milliseconds (default: 10000) */
    OIDC_DISCOVERY_TIMEOUT_MS: number;

    RATE_LIMIT_TTL: number;
    RATE_LIMIT_LIMIT: number;

    USE_PKCE: boolean;

    LOG_LEVEL: LogLevel;

    CERT_BRUNO_SRC_REF?: string;
    CERT_BRUNO_SRC_CHECKSUM?: string;
    CERT_BRUNO_ON_DOWNLOAD_ERROR?: 'error' | 'warn' | 'skip';

    /** Polling interval for MSSQL job queue in milliseconds (default: 1000) */
    MSSQL_JOB_POLL_MS?: number;
    /** Polling interval for MSSQL schedule loop in milliseconds (default: 10000) */
    MSSQL_SCHEDULE_POLL_MS?: number;
  }

  const config: ConfigClass;

  export = config;
}
