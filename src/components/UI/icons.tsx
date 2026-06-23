/**
 * Inline stroke icons (no icon dependency). All inherit `currentColor`
 * and accept a className for sizing/coloring.
 */
type IconProps = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function LockIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      <circle cx="12" cy="15.5" r="1.25" />
    </svg>
  );
}

export function RadarIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 12V3.5" />
      <path d="M12 12a8.5 8.5 0 1 0 6.01 2.49" />
      <path d="M12 12a4.25 4.25 0 1 0 3 1.25" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function BoltIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M13 3 5 13h6l-1 8 8-10h-6l1-8Z" />
    </svg>
  );
}

export function SendIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5 12 20 4l-4 16-4-7-7-1Z" />
      <path d="m12 13 4-5" />
    </svg>
  );
}
