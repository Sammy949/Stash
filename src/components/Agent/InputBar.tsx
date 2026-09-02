import { useEffect, useRef, useState } from "react";
import { SendIcon, SparkleIcon, StopIcon } from "@/components/UI/icons";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/shadcn/input-group";
import { Kbd } from "@/components/shadcn/kbd";

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

/**
 * The composer, built on InputGroup.
 *
 * The primitive owns the parts that were previously hand-rolled and slightly
 * wrong: the focus ring lives on the group rather than the textarea (so the
 * whole control lights up as one object), clicking any padding focuses the
 * field, and `field-sizing-content` on the textarea grows it without a
 * scrollHeight measurement on every keystroke.
 */
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
  const [phIdx, setPhIdx] = useState(() =>
    Math.floor(Math.random() * PLACEHOLDERS.length),
  );

  // Focus when the panel becomes active, and refocus after a turn settles
  // (disabled → false) while still active — but never on the dashboard.
  useEffect(() => {
    if (autoFocus && !disabled) taRef.current?.focus();
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

  function send() {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText("");
  }

  const canSend = Boolean(text.trim()) && !disabled;

  return (
    <InputGroup className="rounded-2xl bg-card">
      <InputGroupAddon align="inline-start" className="self-start pt-2">
        <SparkleIcon className="size-4 text-primary" aria-hidden="true" />
      </InputGroupAddon>

      <InputGroupTextarea
        ref={taRef}
        rows={1}
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // Enter sends; Shift+Enter inserts a newline (long prompts on mobile).
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        placeholder={PLACEHOLDERS[phIdx]}
        aria-label="Message Stash"
        className="max-h-40 min-h-9"
      />

      <InputGroupAddon align="inline-end" className="self-end pb-1.5">
        {/* The hint is decoration for pointer users; it never replaces the
            button, and it hides on small screens where space is scarce. */}
        {canSend && (
          <span
            aria-hidden="true"
            className="hidden items-center gap-1 text-[10px] text-muted-foreground sm:flex"
          >
            <Kbd>↵</Kbd> send
          </span>
        )}
        {disabled && onStop ? (
          <InputGroupButton
            size="icon-sm"
            variant="outline"
            onClick={onStop}
            aria-label="Stop generating"
            className="rounded-full"
          >
            <StopIcon className="size-4" />
          </InputGroupButton>
        ) : (
          <InputGroupButton
            size="icon-sm"
            variant="default"
            onClick={send}
            disabled={!canSend}
            aria-label="Send message"
            className="rounded-full"
          >
            <SendIcon className="size-4" />
          </InputGroupButton>
        )}
      </InputGroupAddon>
    </InputGroup>
  );
}
