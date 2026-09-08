/**
 * The Stash brand mark.
 *
 * Renders the brand SVG from /public, kept behind one component so the asset is
 * swapped in exactly one place. Decorative by default — every
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
      // No CSS radius: the artwork carries its own rounded silhouette on a
      // transparent ground, and a `rounded-*` clip on top only shaves its
      // corners at some sizes (rounded-lg is 28.6% of a 28px mark, but the
      // mark's own corners are 25%). Let the asset define its shape.
      className={`shrink-0 ${className}`}
    />
  );
}
