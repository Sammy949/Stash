/**
 * Three dots, blinking in sequence — Stash composing a reply.
 *
 * This replaces a spinning arc in the "Thinking…" marker. A spinner is the
 * generic "something is loading" mark and says nothing about what is actually
 * happening; dots are the one motion that reads specifically as *someone is
 * about to speak*, which is exactly the wait this covers.
 *
 * Built on the existing `animate-blink` keyframes (already used by the sync
 * indicator's dot), staggered by a delay rather than three bespoke animations,
 * so the transcript borrows the motion the rest of the app already speaks.
 *
 * Reduced motion: `animate-blink` resolves to `animation: none`, which leaves
 * three solid dots. The indicator is still fully visible and still means "in
 * flight" — it simply stops moving. Nothing here is gated on the animation.
 */
export function TypingDots({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {[0, 160, 320].map((delay) => (
        <span
          key={delay}
          className="animate-blink size-1.5 rounded-full bg-current"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}
