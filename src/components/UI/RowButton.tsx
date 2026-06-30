/** Small ghost icon-button used for per-row actions in list cards. */
export function RowButton({
  label,
  onClick,
  tone = "muted",
  children,
}: {
  label: string;
  onClick: () => void;
  tone?: "muted" | "emerald" | "red";
  children: React.ReactNode;
}) {
  const color =
    tone === "emerald"
      ? "text-emerald hover:bg-emerald/10"
      : tone === "red"
        ? "text-red hover:bg-red/10"
        : "text-muted hover:bg-bg hover:text-ink";
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors ${color}`}
    >
      {children}
    </button>
  );
}
