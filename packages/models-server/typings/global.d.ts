declare global {
  namespace NodeJS {
    interface Global {
      DB_SECRETS_ENCRYPTION?: {
        KEY: string;
        IV: string;
      };
    }
  }

  var DB_SECRETS_ENCRYPTION: {
    KEY: string;
    IV: string;
  } | undefined;
}

export {};
