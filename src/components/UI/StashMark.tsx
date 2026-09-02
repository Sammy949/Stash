/**
 * The Stash brand mark.
 *
 * Placeholder: this renders the app's own logo asset until a proper SVG lands.
 * It is one component so that swap is one file. Decorative by default — every
 * place it appears already has a visible label or the message text beside it, so
 * announcing it again would just be noise.
 */
export function StashMark({
  className = "h-7 w-7",
  label,
}: {
  className?: string;
  /** Set only when the mark is the sole thing identifying what it labels. */
  label?: string;
}) {
  return (
    <img
      src="/logo.svg"
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      className={`shrink-0 rounded-lg ${className}`}
    />
  );
}
