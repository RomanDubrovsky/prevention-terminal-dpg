/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TERMINAL_EDITION?: string;
  readonly VITE_TERMINAL_STAGING?: string;
  readonly VITE_TERMINAL_PRODUCT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
