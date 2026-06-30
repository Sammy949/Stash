import type { ReactNode } from "react";

/**
 * One-shot fade/slide-in wrapper for the dashboard entrance. Uses the slower
 * `animate-enter` curve (with `both` fill, so a delay doesn't flash) and runs
 * on mount — and re-runs when the subtree remounts (e.g. returning to the
 * dashboard), never on a plain re-render.
 */
export function FadeIn({
  delay = 0,
  duration = 600,
  className = "",
  children,
}: {
  delay?: number;
  /** Milliseconds — slower reads as more deliberate. */
  duration?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`animate-enter ${className}`}
      style={{ animationDelay: `${delay}ms`, animationDuration: `${duration}ms` }}
    >
      {children}
    </div>
  );
}
