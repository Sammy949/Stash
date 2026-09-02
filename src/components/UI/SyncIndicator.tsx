import type { SyncPhase } from "@/types";

const PHASE: Record<
  Exclude<SyncPhase, "idle">,
  { label: string; color: string }
> = {
  encrypting: { label: "Encrypting ledger…", color: "text-warning" },
  uploading: { label: "Uploading to 0G…", color: "text-warning" },
  confirmed: { label: "Synced to 0G ✓", color: "text-primary" },
  error: { label: "Sync failed", color: "text-destructive" },
  pending: { label: "Saved locally · syncing to 0G when ready", color: "text-warning" },
};

/** Live sync status pill; renders nothing when idle. */
export function SyncIndicator({ phase }: { phase: SyncPhase }) {
  if (phase === "idle") return null;
  const { label, color } = PHASE[phase];
  const busy = phase === "encrypting" || phase === "uploading";

  return (
    <span className={`flex items-center gap-1.5 text-xs ${color}`}>
      {busy && (
        <span className="h-1.5 w-1.5 animate-blink rounded-full bg-current" />
      )}
      {label}
    </span>
  );
}
