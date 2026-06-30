import { useEffect, useState } from "react";
import { CloseIcon, PlusIcon, TrashIcon } from "@/components/UI/icons";

export interface ManageItem {
  id: string;
  primary: string;
  secondary: string;
  badge?: string;
}

/**
 * Overlay sheet to view/manage all of a tracker's entries (scholarships or
 * hustles). Removal is direct (with an inline confirm); **adding flows through
 * the agent** — `onAdd` primes the conversation and closes the sheet — so the
 * app stays agent-first. Single-column overlay, not a route.
 */
export function ManageSheet({
  title,
  items,
  addLabel,
  onRemove,
  onAdd,
  onClose,
}: {
  title: string;
  items: ManageItem[];
  addLabel: string;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 animate-fade bg-black/60"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative z-10 flex max-h-[80vh] w-full max-w-2xl animate-slide-up flex-col overflow-hidden rounded-t-3xl border border-line bg-card sm:rounded-3xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-bg hover:text-ink"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {/* List */}
        <ul className="flex-1 divide-y divide-line overflow-y-auto px-2 py-1">
          {items.map((it) => (
            <ManageRow key={it.id} item={it} onRemove={() => onRemove(it.id)} />
          ))}
        </ul>

        {/* Add via agent */}
        <div className="border-t border-line p-4">
          <button
            type="button"
            onClick={onAdd}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-bg/40 py-2.5 text-sm text-muted transition-colors hover:border-emerald/40 hover:text-ink"
          >
            <PlusIcon className="h-4 w-4" />
            {addLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** One row with an inline two-step remove confirm. */
function ManageRow({
  item,
  onRemove,
}: {
  item: ManageItem;
  onRemove: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="flex items-center gap-3 px-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.primary}</p>
        <p className="truncate text-xs text-muted">{item.secondary}</p>
      </div>

      {item.badge && !confirming && (
        <span className="font-data shrink-0 text-xs text-muted">{item.badge}</span>
      )}

      {confirming ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-lg px-2 py-1 text-xs text-muted transition-colors hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg border border-red/40 bg-red/10 px-2 py-1 text-xs font-medium text-red transition-colors hover:bg-red/20"
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={`Remove ${item.primary}`}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-bg hover:text-red"
        >
          <TrashIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
}
