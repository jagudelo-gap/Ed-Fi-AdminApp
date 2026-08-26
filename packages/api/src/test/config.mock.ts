const config = {
  ENABLE_OPEN_API: false,
  OPEN_API: false,
  API_PORT: 3333,

  DB_SSL: false,
  DB_RUN_MIGRATIONS: true,
  DB_SYNCHRONIZE: false,
  DB_ENGINE: 'pgsql' as const,
  DB_TRUST_CERTIFICATE: false,
  DB_TTL_IN_MINUTES: 120,

  TYPEORM_LOGGING: undefined,
  TYPEORM_RETRY_ATTEMPTS: 3,
  TYPEORM_RETRY_DELAY: 3000,

  AWS_REGION: 'us-east-2',
  AWS_DB_SECRET: undefined,
  DB_SECRET_VALUE: {
    DB_HOST: 'localhost',
    DB_PORT: 5432,
    DB_USERNAME: 'user',
    DB_DATABASE: 'db',
    DB_PASSWORD: 'pass',
  },

  AWS_DB_ENCRYPTION_SECRET: undefined,
  DB_ENCRYPTION_SECRET_VALUE: {
    KEY: 'ef9c1dcd53175358daefcce54891e1779f9837d5ff25c74a674de3d1a749d81f',
    IV: 'iv',
  },
  DB_ENCRYPTION_SECRET: {
    KEY: 'ef9c1dcd53175358daefcce54891e1779f9837d5ff25c74a674de3d1a749d81f',
    IV: 'iv',
  },

  DB_CONNECTION_STRING: 'postgres://user@localhost:5432/db?password=pass&sslmode=disable',

  FE_URL: 'http://localhost:4200',
  MY_URL: 'http://localhost:3333',
  get MY_URL_API_PATH() {
    return this.MY_URL.endsWith('/api') ? this.MY_URL : `${this.MY_URL}/api`;
  },

  USE_YOPASS: false,
  YOPASS_URL: 'http://localhost:8082',
  WHITELISTED_REDIRECTS: ['http://localhost:4200'],

  SB_SYNC_CRON: '0 2 * * *',
  ADMINAPI_REFRESH_POLL_ATTEMPTS: 3,
  ADMINAPI_REFRESH_POLL_INTERVAL_MS: 0,

  OPENAPI_TITLE: 'Starting Blocks Admin App',
  OPENAPI_DESCRIPTION: 'OpenAPI spec for the EA Starting Blocks admin application.',
  EDFI_URLS_TIMEOUT_MS: 5000,

  RATE_LIMIT_TTL: 60000,
  RATE_LIMIT_LIMIT: 100,
  USE_PKCE: true,
  SSL_VERIFICATION: false,
  LOG_LEVEL: 'log',

  AUTH0_CONFIG_SECRET: {
    ISSUER: 'https://issuer.example',
    CLIENT_ID: 'client-id',
    CLIENT_SECRET: 'client-secret',
    MACHINE_AUDIENCE: 'audience',
  },

  CERT_BRUNO_SRC_REF: 'v2.1.0',
  CERT_BRUNO_SRC_CHECKSUM: '71840f51f464c60d7b90c7bbf08d9be039df291d51dd69085ffc4703b98f11e6',
  CERT_BRUNO_ON_DOWNLOAD_ERROR: 'error' as const,

  ADMIN_USERNAME: undefined,
  SAMPLE_OIDC_CONFIG: undefined,
};

export = config;
