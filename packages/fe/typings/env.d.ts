/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL of the back-end API */
  readonly VITE_API_URL: string;
  readonly VITE_OIDC_ID: number;
  readonly VITE_HELP_GUIDE: string;
  readonly VITE_STARTING_GUIDE: string;
  readonly VITE_CONTACT: string;
  readonly VITE_APPLICATION_NAME: string;
  /** URL for the IdP account management page */
  readonly VITE_IDP_ACCOUNT_URL: string;
  readonly VITE_SHOW_REQUEST_CERTIFICATION?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
