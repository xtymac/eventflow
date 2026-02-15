/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_IS_DEMO?: string; // Set to 'true' for local demo testing
  readonly VITE_DEMO_DOMAINS?: string; // Comma-separated whitelist of demo hostnames
  readonly VITE_ENABLE_ADMIN_NAV?: string; // Set to 'false' to disable admin nav feature (kill switch)
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
