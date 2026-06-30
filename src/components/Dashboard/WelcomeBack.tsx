import type {
  WelcomeBack as WelcomeBackData,
  FactTone,
} from "@/lib/welcomeBack";
import { CloseIcon } from "@/components/UI/icons";

const DOT: Record<FactTone, string> = {
  accent: "bg-emerald",
  warn: "bg-amber",
  default: "bg-muted",
};

/* Stash's vault glyph, in its accent ring — the agent "speaking". Currently
   disabled in the greeting card; kept here (commented) for easy restore.
function StashGlyph() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald/30 bg-emerald/10">
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-emerald">
        <circle
          cx="12"
          cy="12"
          r="7"
          stroke="currentColor"
          strokeWidth="1.75"
        />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
      </svg>
    </div>
  );
}
*/

/**
 * The welcome-back greeting card — memory felt as Stash greeting you on return,
 * not a static "what I know" list. Deterministic content (see deriveWelcomeBack);
 * dismissible.
 */
export function WelcomeBack({
  data,
  onDismiss,
}: {
  data: WelcomeBackData;
  onDismiss: () => void;
}) {
  return (
    <section className="animate-slide-up rounded-2xl border border-emerald/25 bg-emerald/[0.06] p-5">
      <div className="flex items-start gap-3">
        {/* <StashGlyph /> */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-lg font-semibold text-ink">{data.greeting}</p>
              <p className="label-caps mt-0.5 text-[10px] text-muted">
                Since you were last here
              </p>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss"
              className="-mr-1.5 -mt-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-bg hover:text-ink"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
          <ul className="mt-3 space-y-2">
            {data.facts.map((f, i) => (
              <li
                key={i}
                className="flex items-center gap-2.5 text-sm text-ink"
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[f.tone]}`}
                />
                <span>{f.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
