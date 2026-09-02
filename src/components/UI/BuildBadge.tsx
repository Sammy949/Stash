import { useEffect, useState } from "react";

/**
 * Build hash + a live clock, side by side.
 *
 * This exists for the submission's recall beat, which has to be one continuous
 * unedited take: the SHA stays constant across a reload while the clock keeps
 * running, so there is visibly no cut. It is genuinely data (a commit hash and a
 * timestamp), which is the one place mono type earns its keep.
 */
export function BuildBadge({ className = "" }: { className?: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const clock = now.toLocaleTimeString(undefined, {
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
      <span aria-hidden="true" className="px-1.5 opacity-50">
        ·
      </span>
      <time dateTime={now.toISOString()}>{clock}</time>
    </span>
  );
}
