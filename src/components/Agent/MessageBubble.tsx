import type { ChatMessage } from "@/types";

/** Stash avatar — small emerald vault glyph. */
function StashAvatar() {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald/30 bg-emerald/10">
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

function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1">
      {[0, 0.2, 0.4].map((d) => (
        <span
          key={d}
          className="h-1.5 w-1.5 rounded-full bg-muted animate-blink"
          style={{ animationDelay: `${d}s` }}
        />
      ))}
    </span>
  );
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const mine = message.role === "user";

  if (mine) {
    return (
      <div className="flex justify-end animate-slide-up">
        <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-slate px-3.5 py-2.5 text-sm leading-relaxed text-ink">
          {message.content}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5 animate-slide-up">
      <StashAvatar />
      <div className="max-w-[80%] rounded-2xl rounded-tl-sm border border-line bg-bg/60 px-3.5 py-2.5 text-sm leading-relaxed text-ink">
        {message.pending ? (
          <TypingDots />
        ) : (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}
      </div>
    </div>
  );
}
