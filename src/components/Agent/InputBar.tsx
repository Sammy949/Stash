import { useEffect, useRef, useState } from "react";
import { SendIcon, SparkleIcon, StopIcon } from "@/components/UI/icons";

export function InputBar({
  onSend,
  onStop,
  disabled = false,
}: {
  onSend: (text: string) => void;
  /** Cancel the in-flight turn. When `disabled` (a turn is running) and this
   *  is provided, the send button becomes a Stop button. */
  onStop?: () => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!disabled) {
      taRef.current?.focus();
    }
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
    <div className="flex items-end gap-1.5 rounded-3xl border border-line bg-bg px-2 py-1.5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.7)] transition-colors focus-within:border-emerald/50">
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
        placeholder="Try: “I got paid ₦20,000” or “I spent ₦3,000 on lunch”"
        className="max-h-40 flex-1 resize-none bg-transparent py-2 text-sm leading-relaxed outline-none placeholder:text-muted disabled:opacity-50"
      />
      {disabled && onStop ? (
        <button
          type="button"
          onClick={onStop}
          aria-label="Stop"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink transition-opacity hover:opacity-90"
        >
          <StopIcon className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={send}
          disabled={disabled || !text.trim()}
          aria-label="Send"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SendIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
