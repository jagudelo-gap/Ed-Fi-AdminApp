// Shape of the final config
export interface AppConfig {
  apiUrl: string;
  oidcId: string;
  basePath: string;
  helpGuide?: string;
  startingGuide?: string;
  contact?: string;
  applicationName?: string;
  idpAccountUrl?: string;
}

// Runtime config pushed by /config.js (optional)
type RuntimeConfig = {
  VITE_API_URL?: string;
  VITE_OIDC_ID?: string;
  VITE_HELP_GUIDE?: string;
  VITE_BASE_PATH?: string;
  VITE_STARTING_GUIDE?: string;
  VITE_CONTACT?: string;
  VITE_APPLICATION_NAME?: string;
  VITE_IDP_ACCOUNT_URL?: string;
};

// Read runtime overrides (if any)
const runtime: RuntimeConfig = (window as Window & typeof globalThis).__APP_CONFIG__ ?? {};

// Read build-time env (Vite)
const env = import.meta.env;

// Final merged config
export const config: Readonly<AppConfig> = Object.freeze({
  apiUrl: runtime.VITE_API_URL ?? env.VITE_API_URL ?? "/api",
  helpGuide: runtime.VITE_HELP_GUIDE ?? env.VITE_HELP_GUIDE,
  basePath: runtime.VITE_BASE_PATH ?? env.VITE_BASE_PATH ?? '/',
  startingGuide: runtime.VITE_STARTING_GUIDE ?? env.VITE_STARTING_GUIDE,
  contact: runtime.VITE_CONTACT ?? env.VITE_CONTACT,
  applicationName: runtime.VITE_APPLICATION_NAME ?? env.VITE_APPLICATION_NAME,
  idpAccountUrl: runtime.VITE_IDP_ACCOUNT_URL ?? env.VITE_IDP_ACCOUNT_URL,
  oidcId: String(runtime.VITE_OIDC_ID ?? env.VITE_OIDC_ID)
});
