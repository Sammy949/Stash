import type { ReactNode } from "react";

/**
 * One-shot fade/slide-in wrapper. `backwards` fill applies the start frame
 * during the delay, so staggered children don't flash before animating. Runs
 * on mount (and re-runs when the subtree remounts — e.g. returning to the
 * dashboard), never on a plain re-render.
 */
export function FadeIn({
  delay = 0,
  className = "",
  children,
}: {
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`animate-slide-up [animation-fill-mode:backwards] ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
