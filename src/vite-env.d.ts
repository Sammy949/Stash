/// <reference types="vite/client" />

/** Short commit hash of this build, injected by vite.config.ts. */
declare const __BUILD_SHA__: string;

interface ImportMetaEnv {
  /**
   * Inference provider. Any OpenAI-compatible chat-completions endpoint —
   * the agent loop does not care which, and the deployed build points these
   * at Groq. Optional so a build without them still compiles; the app
   * degrades to a clear error rather than failing to start.
   */
  readonly VITE_AI_BASE_URL?: string;
  readonly VITE_AI_API_KEY?: string;
  readonly VITE_AI_MODEL?: string;
  /** Same provider, separate rate-limit bucket. Used when the primary caps. */
  readonly VITE_AI_FALLBACK_MODEL?: string;
  readonly VITE_MEMORY_TENANT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
