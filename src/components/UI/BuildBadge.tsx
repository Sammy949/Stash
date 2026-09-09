/**
 * Build hash and a live clock, side by side.
 *
 * This exists for the submission's recall beat, which has to be one continuous
 * unedited take: the SHA stays constant across a reload while the clock keeps
 * running, so there is visibly no cut. It is genuinely data (a commit hash and a
 * timestamp), which is the one place mono type earns its keep.
 *
 * `clock` is opt-in. In the header the SHA alone is enough chrome; the running
 * clock lives in the account menu, where it is on screen when it needs to be
 * without a ticking number sitting in the nav all day.
 */
import { useEffect, useState } from "react";

export function BuildBadge({
  className = "",
  clock = false,
}: {
  className?: string;
  /** Append a live HH:MM:SS clock. Off by default. */
  clock?: boolean;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!clock) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [clock]);

  const time = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return (
    <span
      className={`font-data shrink-0 text-[10px] leading-none text-muted-foreground ${className}`}
      title={`build ${__BUILD_SHA__}`}
    >
      {__BUILD_SHA__}
      {clock && (
        <>
          <span aria-hidden="true" className="px-1.5 opacity-50">
            ·
          </span>
          <time dateTime={now.toISOString()}>{time}</time>
        </>
      )}
    </span>
  );
}
