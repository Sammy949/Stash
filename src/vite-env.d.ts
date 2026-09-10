/// <reference types="vite/client" />

/** Short commit hash of this build, injected by vite.config.ts. */
declare const __BUILD_SHA__: string;

interface ImportMetaEnv {
  readonly VITE_MEMORY_TENANT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
