import type { SyncPhase } from "@/types";

/** STUB — animated 0G sync sequence built in step 3. */
export function SyncIndicator({ phase }: { phase: SyncPhase }) {
  if (phase === "idle") return null;
  return <span className="text-xs text-muted">{phase}…</span>;
}
