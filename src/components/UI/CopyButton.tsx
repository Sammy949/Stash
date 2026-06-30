import { useState } from "react";
import { CheckIcon, CopyIcon } from "@/components/UI/icons";

/** Small icon button that copies `text` to the clipboard, flashing a check. */
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
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : "Copy"}
      className={`flex h-11 w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-bg hover:text-ink ${className}`}
    >
      {copied ? (
        <CheckIcon className="h-3.5 w-3.5 text-emerald" />
      ) : (
        <CopyIcon className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
