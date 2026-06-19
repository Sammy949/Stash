/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 0G Compute Router API key (OpenAI-compatible). */
  readonly VITE_OG_COMPUTE_API_KEY: string;
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
