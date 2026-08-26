const FE_URL = 'http://localhost:4200';

module.exports = {
  API_PORT: 3333,
  DB_SSL: false,
  AWS_REGION: 'us-east-2',
  FE_URL: FE_URL,
  MY_URL: 'http://localhost:3333',
  YOPASS_URL: 'http://localhost:8082',

  // TYPEORM_LOGGING: `["query"]`,

  DB_SECRET_VALUE: {
    DB_HOST: 'localhost',
    DB_PORT: 3305,
    DB_USERNAME: 'sbaa',
    DB_DATABASE: 'sbaa',
    DB_PASSWORD: 'dev',
  },
  DB_ENCRYPTION_SECRET_VALUE: {
    KEY: 'ef9c1dcd53175358daefcce54891e1779f9837d5ff25c74a674de3d1a749d81f',
    IV: '<not needed, should factor out but havent bothered yet>',
  },
  WHITELISTED_REDIRECTS: [FE_URL],
  ADMINAPI_REFRESH_POLL_ATTEMPTS: 3,
  ADMINAPI_REFRESH_POLL_INTERVAL_MS: 0,
};
