import type { SyncPhase } from "@/types";
import { CheckIcon } from "@/components/UI/icons";

/**
 * Live sync status; renders nothing when idle.
 *
 * Colour discipline, per the rule the palette states out loud: `warning` is for
 * warnings, and a sync doing exactly what it should is not one. Encrypting,
 * uploading and "saved locally, syncing when ready" all used to be amber, which
 * painted the normal path — and, in `pending`'s case, the local-first design
 * working as intended — as though something were wrong. They are quiet status
 * ink now. `error` keeps the alarm colour, because a failed backup is genuinely
 * something to act on.
 */
const PHASE: Record<
  Exclude<SyncPhase, "idle">,
  { label: string; color: string }
> = {
  encrypting: { label: "Encrypting ledger…", color: "text-muted-foreground" },
  uploading: { label: "Backing up…", color: "text-muted-foreground" },
  confirmed: { label: "Backed up", color: "text-foreground" },
  error: { label: "Sync failed", color: "text-destructive" },
  pending: {
    label: "Saved locally · backing up when ready",
    color: "text-muted-foreground",
  },
};

export function SyncIndicator({ phase }: { phase: SyncPhase }) {
  if (phase === "idle") return null;
  const { label, color } = PHASE[phase];
  const busy = phase === "encrypting" || phase === "uploading";

  return (
    <span className={`flex items-center gap-1.5 text-xs ${color}`}>
      {busy && (
        <span className="h-1.5 w-1.5 animate-blink rounded-full bg-current" />
      )}
      {/* A real mark rather than a "✓" typed into the label string, so it
          matches every other tick in the interface. */}
      {phase === "confirmed" && <CheckIcon className="size-3" />}
      {label}
    </span>
  );
}
