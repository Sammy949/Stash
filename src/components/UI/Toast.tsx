import { useEffect } from "react";
import type { ToastState } from "@/hooks/useLedger";

/** Short root-hash badge: "#a7f3c2b1…". */
function shortRoot(rootHash: string): string {
  const hex = rootHash.replace(/^0x/, "");
  return hex ? `#${hex.slice(0, 8)}…` : "";
}

export function Toast({
  toast,
  onClose,
}: {
  toast: ToastState;
  onClose: () => void;
}) {
  useEffect(() => {
    const t = window.setTimeout(onClose, 4500);
    return () => window.clearTimeout(t);
  }, [toast, onClose]);

  const success = toast.kind === "success";
  const border = success ? "border-emerald/40" : "border-red/40";
  const pulse = success ? "animate-stash-pulse" : "";
  const root = shortRoot(toast.rootHash);

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm">
      <div
        className={`animate-slide-up rounded-xl border ${border} bg-card px-4 py-3 text-sm shadow-xl ${pulse}`}
      >
        <span className="mr-1">{success ? "🔐" : "⚠️"}</span>
        <span className="text-ink">{toast.message}</span>
        {root && (
          <>
            <span className="text-muted"> · Root: </span>
            <span className="font-mono text-xs text-emerald">{root}</span>
          </>
        )}
      </div>
    </div>
  );
}
