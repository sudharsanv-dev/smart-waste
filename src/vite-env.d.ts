/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_MODE?: string;
  readonly VITE_USE_MOCK_API?: string | boolean;
  readonly VITE_ENABLE_DEMO_TOOLS?: string | boolean;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_OPERATIONAL_TIMEZONE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
