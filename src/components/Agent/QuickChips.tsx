/** STUB — tappable quick-action chips built in step 4. */
export function QuickChips({ onPick }: { onPick: (prompt: string) => void }) {
  const chips = [
    "📊 Analyze my spending",
    "🎓 Scholarship deadlines",
    "💡 Match me to hustles",
    "🔐 Sync to 0G",
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <button
          key={c}
          onClick={() => onPick(c)}
          className="rounded-full border border-line bg-card px-3 py-1.5 text-xs text-muted hover:text-ink"
        >
          {c}
        </button>
      ))}
    </div>
  );
}
