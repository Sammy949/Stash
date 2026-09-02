import type {
  WelcomeBack as WelcomeBackData,
  FactTone,
} from "@/lib/welcomeBack";
import { CloseIcon } from "@/components/UI/icons";

const DOT: Record<FactTone, string> = {
  accent: "bg-primary",
  warn: "bg-warning",
  default: "bg-muted-foreground",
};

/**
 * The welcome-back greeting card — memory felt as Stash greeting you on return,
 * not a static "what I know" list. Deterministic content (see deriveWelcomeBack),
 * and it only exists when Sibyl actually remembers something; dismissible.
 */
export function WelcomeBack({
  data,
  onDismiss,
}: {
  data: WelcomeBackData;
  onDismiss: () => void;
}) {
  return (
    <section className="animate-slide-up rounded-2xl border border-primary/25 bg-primary/[0.06] p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-lg font-semibold text-foreground">{data.greeting}</p>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss"
              className="-mr-1.5 -mt-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
          <ul className="mt-3 space-y-2">
            {data.facts.map((f, i) => (
              <li
                key={i}
                className="flex items-center gap-2.5 text-sm text-foreground"
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
