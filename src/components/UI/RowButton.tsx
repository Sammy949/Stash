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
      ? "text-primary hover:bg-primary/10"
      : tone === "red"
        ? "text-destructive hover:bg-destructive/10"
        : "text-muted-foreground hover:bg-background hover:text-foreground";
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
