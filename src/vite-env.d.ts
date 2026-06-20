/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 0G Compute Router API key (OpenAI-compatible). */
  readonly VITE_OG_COMPUTE_API_KEY: string;

  /**
   * Optional OpenAI-compatible fallback provider. When VITE_AI_BASE_URL is
   * set, it overrides the 0G Router for chat (testnet builds without a
   * mainnet Router balance). Leave unset to run on 0G Compute.
   */
  readonly VITE_AI_BASE_URL?: string;
  readonly VITE_AI_API_KEY?: string;
  readonly VITE_AI_MODEL?: string;
  /** Testnet wallet private key used to sign 0G Storage uploads. */
  readonly VITE_OG_PRIVATE_KEY: string;
  /** 0G Galileo testnet EVM RPC. */
  readonly VITE_OG_RPC_URL: string;
  /** 0G Storage turbo indexer gateway. */
  readonly VITE_OG_INDEXER_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
