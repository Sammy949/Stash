import { useState } from "react";
import { Button } from "@/components/shadcn/button";
import { CheckIcon, CopyIcon } from "@/components/UI/icons";

/**
 * Copies `text` to the clipboard, flashing a tick.
 *
 * Built on the Button primitive rather than a hand-rolled `<button>`: the ghost
 * icon variant already carries the hover, focus-visible and disabled states,
 * and `size="icon"` is the system's 32px control — the hand-rolled version was
 * a 44px outlier that no other control on the page matched.
 */
export function CopyButton({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context / permissions) — fail quietly.
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={copy}
      aria-label={copied ? "Copied" : "Copy"}
      className={`text-muted-foreground hover:text-foreground ${className}`}
    >
      {copied ? (
        <CheckIcon className="size-3.5 text-primary" />
      ) : (
        <CopyIcon className="size-3.5" />
      )}
    </Button>
  );
}
