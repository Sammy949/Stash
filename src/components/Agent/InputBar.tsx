import { useEffect, useRef, useState } from "react";
import { SendIcon } from "@/components/UI/icons";

export function InputBar({
  onSend,
  disabled = false,
}: {
  onSend: (text: string) => void;
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
    <div className="flex items-end gap-2">
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
        className="max-h-40 flex-1 resize-none rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted focus:border-emerald/50 disabled:opacity-50"
      />
      <button
        type="button"
        onClick={send}
        disabled={disabled || !text.trim()}
        aria-label="Send"
        className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-emerald text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <SendIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
