/**
 * 0G Storage sync proxy (Vercel serverless, Node runtime).
 *
 * WHY THIS EXISTS: the 0G testnet storage nodes are served over plain
 * HTTP on bare IPs (e.g. http://34.x.x.x:5678). A browser on our HTTPS
 * deployment blocks those as mixed content, so the upload/download can
 * never run client-side in production. This function runs the 0G SDK
 * server-side (Node → HTTP nodes is fine) and the browser talks to it
 * over same-origin HTTPS instead.
 *
 * Bonus: the wallet private key lives in SERVER env (OG_PRIVATE_KEY),
 * not the client bundle.
 *
 *   POST  { ledger }      → encrypt + upload → { rootHash, syncedAt }
 *   GET   ?root=0x..      → download + decrypt → { ledger }
 *
 * Typed loosely (req/res: any) so it needs no @vercel/node dependency.
 */

import { ethers } from "ethers";
import { Indexer, MemData } from "@0gfoundation/0g-storage-ts-sdk";

const RPC_URL = process.env.OG_RPC_URL || process.env.VITE_OG_RPC_URL;
const INDEXER_URL = process.env.OG_INDEXER_URL || process.env.VITE_OG_INDEXER_URL;
const PRIVATE_KEY = process.env.OG_PRIVATE_KEY || process.env.VITE_OG_PRIVATE_KEY;

const KEY_DOMAIN = "stash-ledger-v1:";

function deriveAesKey(privateKey: string): Uint8Array {
  return ethers.getBytes(ethers.sha256(ethers.toUtf8Bytes(KEY_DOMAIN + privateKey)));
}

function configured(): boolean {
  return Boolean(RPC_URL && INDEXER_URL && PRIVATE_KEY);
}

async function uploadLedger(ledger: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(ledger));
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(PRIVATE_KEY as string, provider);
  const indexer = new Indexer(INDEXER_URL as string);
  const key = deriveAesKey(PRIVATE_KEY as string);

  const [res, err] = await indexer.upload(new MemData(bytes), RPC_URL as string, signer, {
    encryption: { type: "aes256", key },
  });
  if (err) throw err;
  if (!res) throw new Error("0G upload returned no result");
  const rootHash = "rootHash" in res ? res.rootHash : res.rootHashes[0];
  if (!rootHash) throw new Error("0G upload returned no root hash");
  return rootHash;
}

async function downloadLedger(rootHash: string): Promise<unknown> {
  const indexer = new Indexer(INDEXER_URL as string);
  const key = deriveAesKey(PRIVATE_KEY as string);
  const [blob, err] = await indexer.downloadToBlob(rootHash, {
    decryption: { symmetricKey: key },
  });
  if (err) throw err;
  if (!blob) throw new Error("0G download returned no data");
  const text = new TextDecoder().decode(await blob.arrayBuffer());
  return JSON.parse(text);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (!configured()) {
    return res
      .status(500)
      .json({ error: "0G Storage not configured on the server (OG_PRIVATE_KEY/RPC/INDEXER)." });
  }

  try {
    if (req.method === "POST") {
      const ledger = req.body?.ledger ?? req.body;
      if (!ledger || typeof ledger !== "object") {
        return res.status(400).json({ error: "POST body must include a ledger object." });
      }
      const rootHash = await uploadLedger(ledger);
      return res.status(200).json({ rootHash, syncedAt: new Date().toISOString() });
    }

    if (req.method === "GET") {
      const root = req.query?.root as string | undefined;
      if (!root) return res.status(400).json({ error: "Missing ?root= query param." });
      const ledger = await downloadLedger(root);
      return res.status(200).json({ ledger });
    }

    return res.status(405).json({ error: "Method not allowed." });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return res.status(502).json({ error: `0G sync failed: ${message}` });
  }
}
