import type { ReactNode } from "react";

/**
 * Per-section empty state — icon + title + a hint that teaches the
 * conversational gesture (Stash is agent-first; there's no manual "add" form,
 * so the CTA shows what to *say* rather than a button to click).
 */
export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-line px-4 py-6 text-center">
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-bg/40 text-muted">
        {icon}
      </div>
      <p className="mt-3 text-sm font-medium text-ink">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p>
    </div>
  );
}
