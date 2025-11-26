export {};

declare global {
  interface Window {
    __APP_CONFIG__?: {
      VITE_API_URL?: string;
      VITE_OIDC_ID?: string;
      VITE_HELP_GUIDE?: string;
      VITE_STARTING_GUIDE?: string;
      VITE_CONTACT?: string;
      VITE_APPLICATION_NAME?: string;
      VITE_IDP_ACCOUNT_URL?: string;
    };
  }
}
