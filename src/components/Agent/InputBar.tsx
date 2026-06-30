import { useEffect, useRef, useState } from "react";
import { SendIcon, SparkleIcon, StopIcon } from "@/components/UI/icons";

/** Rotating prompt hints — keeps the command bar feeling alive (and teaches the
 *  range of things Stash can do) instead of one fixed example. */
const PLACEHOLDERS = [
  "Try: “I got paid ₦20,000”",
  "Try: “I spent ₦3,000 on lunch”",
  "Ask: “Can I afford ₦15k this week?”",
  "Try: “Save ₦50,000 for a laptop”",
  "Try: “Track a scholarship deadline”",
  "Ask: “Where’s my money going?”",
  "Try: “I earn ₦40,000/mo tutoring”",
];

export function InputBar({
  onSend,
  onStop,
  disabled = false,
  autoFocus = false,
}: {
  onSend: (text: string) => void;
  /** Cancel the in-flight turn. When `disabled` (a turn is running) and this
   *  is provided, the send button becomes a Stop button. */
  onStop?: () => void;
  disabled?: boolean;
  /** Only grab focus when the agent panel is open. On the dashboard (cold load)
   *  this stays false so we never pop the mobile keyboard over the numbers. */
  autoFocus?: boolean;
}) {
  const [text, setText] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  // Start on a random hint so each session opens a little differently.
  const [phIdx, setPhIdx] = useState(
    () => Math.floor(Math.random() * PLACEHOLDERS.length),
  );

  // Focus when the panel becomes active, and refocus after a turn settles
  // (disabled → false) while still active — but never on the dashboard.
  useEffect(() => {
    if (autoFocus && !disabled) {
      taRef.current?.focus();
    }
  }, [autoFocus, disabled]);

  // Gently cycle the placeholder hint while idle. Held still during a turn and
  // for reduced-motion users (auto-changing text reads as motion to some).
  useEffect(() => {
    if (disabled) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(
      () => setPhIdx((i) => (i + 1) % PLACEHOLDERS.length),
      4200,
    );
    return () => window.clearInterval(id);
  }, [disabled]);

  function grow() {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`; // cap ~6 lines
  }

  function send() {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText("");
    requestAnimationFrame(() => {
      if (taRef.current) taRef.current.style.height = "auto";
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter inserts a newline (long prompts on mobile).
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    // Floating command pill — one row: AI glyph · input · circular action.
    <div className="flex items-center gap-1.5 rounded-full border border-line bg-bg px-2 py-1 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.7)] transition-colors focus-within:border-emerald/50">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center text-emerald">
        <SparkleIcon className="h-4 w-4" />
      </span>
      <textarea
        ref={taRef}
        rows={1}
        value={text}
        disabled={disabled}
        onChange={(e) => {
          setText(e.target.value);
          grow();
        }}
        onKeyDown={onKeyDown}
        placeholder={PLACEHOLDERS[phIdx]}
        className="max-h-40 flex-1 resize-none bg-transparent py-2 text-sm leading-relaxed outline-none placeholder:text-muted disabled:opacity-50"
      />
      {disabled && onStop ? (
        <button
          type="button"
          onClick={onStop}
          aria-label="Stop"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink transition-opacity hover:opacity-90"
        >
          <StopIcon className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={send}
          disabled={disabled || !text.trim()}
          aria-label="Send"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SendIcon className="h-5 w-5 text-white" />
        </button>
      )}
    </div>
  );
}
