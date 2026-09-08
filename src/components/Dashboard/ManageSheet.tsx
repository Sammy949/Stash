import { useEffect, useState } from "react";
import { CloseIcon, PlusIcon, TrashIcon } from "@/components/UI/icons";
import { Button } from "@/components/shadcn/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/shadcn/item";

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
      <div className="relative z-10 flex max-h-[85dvh] w-full max-w-2xl animate-slide-up flex-col overflow-hidden rounded-t-3xl border border-border bg-card sm:max-h-[80dvh] sm:rounded-3xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {/* List */}
        <ItemGroup className="flex-1 gap-1 overflow-y-auto p-2">
          {items.map((it) => (
            <ManageRow key={it.id} item={it} onRemove={() => onRemove(it.id)} />
          ))}
        </ItemGroup>

        {/* Add via agent */}
        <div className="border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button
            type="button"
            variant="outline"
            onClick={onAdd}
            className="h-11 w-full text-muted-foreground hover:text-foreground"
          >
            <PlusIcon />
            {addLabel}
          </Button>
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
    <Item role="listitem" size="sm">
      <ItemContent className="min-w-0 gap-0.5">
        <ItemTitle className="block w-full truncate" title={item.primary}>
          {item.primary}
        </ItemTitle>
        <ItemDescription className="truncate text-xs">
          {item.secondary}
        </ItemDescription>
      </ItemContent>

      <ItemActions>
        {item.badge && !confirming && (
          <span className="font-data text-xs text-muted-foreground">
            {item.badge}
          </span>
        )}

        {confirming ? (
          <>
            {/* Both confirm buttons keep the 44px touch target the icon button
                has, so the row does not shrink its hit area at the exact moment
                it is asking for a destructive decision. */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirming(false)}
              className="h-11 text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onRemove}
              className="h-11"
            >
              Remove
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setConfirming(true)}
            aria-label={`Remove ${item.primary}`}
            className="size-11 text-muted-foreground hover:text-destructive"
          >
            <TrashIcon className="size-3.5" />
          </Button>
        )}
      </ItemActions>
    </Item>
  );
}
