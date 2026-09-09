import { useEffect, useRef, useState } from "react";
import { SendIcon, SparkleIcon, StopIcon } from "@/components/UI/icons";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/shadcn/input-group";

/**
 * Rotating prompt hints. These teach the range of what Stash can do, which a
 * single fixed example cannot. They are hints, never labels: the field carries a
 * real aria-label of its own.
 */
const PLACEHOLDERS = [
  "I got paid ₦20,000",
  "I spent ₦3,000 on lunch",
  "Can I afford ₦15k this week?",
  "Save ₦50,000 for a laptop",
  "Track a scholarship deadline",
  "Where's my money going?",
  "I earn ₦40,000/mo tutoring",
];

/**
 * The composer.
 *
 * Built on InputGroup with the actions on a `block-end` row rather than inline,
 * which is the shape the shadcn docs use for a prompt textarea and the shape that
 * survives growth: an inline-end button has to align itself against a field whose
 * height changes, and the vertical-centre-vs-bottom compromise is what made the
 * old version read as improvised. On its own row the text occupies the full width
 * and the controls sit on a stable baseline underneath.
 *
 * Only one control is ever present: send, or stop while a turn runs. There is no
 * filled-primary-beside-ghost pair, and no keyboard hint dressed up as a chip.
 *
 * `compact` is the home state's presentation of the SAME composer — one
 * component, two shapes, not a second implementation. Before a conversation
 * exists the composer is an invitation rather than a chat control, so it
 * collapses to a single-line pill: a real `<input>` (there is nothing to
 * compose multi-line yet), the actions inline at the end instead of on their
 * own row, no sparkle, and one fixed placeholder that says what the field is
 * for. The rotating hints belong to the conversation composer, where they teach
 * range; on the home screen a hint that rewrites itself under the cursor is
 * motion competing with the numbers above it.
 */
export function InputBar({
  onSend,
  onStop,
  disabled = false,
  autoFocus = false,
  compact = false,
}: {
  onSend: (text: string) => void;
  /** Cancel the in-flight turn. When `disabled` (a turn is running) and this
   *  is provided, the send button becomes a Stop button. */
  onStop?: () => void;
  disabled?: boolean;
  /** Only grab focus when the agent panel is open. On the dashboard (cold load)
   *  this stays false so we never pop the mobile keyboard over the numbers. */
  autoFocus?: boolean;
  /** Home-state shape: a single-line pill, before any conversation exists. */
  compact?: boolean;
}) {
  const [text, setText] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  // Start on a random hint so each session opens a little differently.
  const [phIdx, setPhIdx] = useState(() =>
    Math.floor(Math.random() * PLACEHOLDERS.length),
  );

  // Focus when the panel becomes active, and refocus after a turn settles
  // (disabled → false) while still active, but never on the dashboard.
  useEffect(() => {
    if (autoFocus && !disabled) taRef.current?.focus();
  }, [autoFocus, disabled]);

  // Cycle the hint while idle. Held still during a turn, and for reduced-motion
  // users, since text that changes on its own reads as motion to some people.
  useEffect(() => {
    if (disabled || compact) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(
      () => setPhIdx((i) => (i + 1) % PLACEHOLDERS.length),
      4200,
    );
    return () => window.clearInterval(id);
  }, [disabled, compact]);

  function send() {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText("");
  }

  const canSend = Boolean(text.trim()) && !disabled;

  // The send affordance is a circle in the compact shape, matching the
  // reference; the conversation composer keeps the squarer control that sits on
  // its own action row.
  const actionShape = compact ? "size-8 rounded-full" : "";

  const action =
    disabled && onStop ? (
      <InputGroupButton
        size="icon-sm"
        variant="outline"
        onClick={onStop}
        aria-label="Stop generating"
        className={`ml-auto ${actionShape}`}
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
        className={`ml-auto ${actionShape}`}
      >
        <SendIcon className="size-4" />
      </InputGroupButton>
    );

  if (compact) {
    return (
      // Radius is one value doing two jobs. A border-radius is clamped to half
      // the box, so 1.75rem renders as a true pill while the field is its
      // resting 48px, and relaxes into a generously rounded box as the textarea
      // grows — no conditional class, and never the semicircular ends a
      // fully-rounded multi-line box would get.
      <InputGroup className="items-center rounded-[1.75rem] border-border bg-card px-1.5">
        <InputGroupTextarea
          ref={taRef}
          rows={1}
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ask Stash anything..."
          aria-label="Message Stash"
          // min-h-11 + py-3 gives the resting 48px bar; it grows from there to
          // a cap, then scrolls, so a long paste can never eat the screen.
          className="max-h-40 min-h-11 self-center px-3 py-3 text-sm leading-relaxed"
        />
        <InputGroupAddon align="inline-end" className="self-center">
          {action}
        </InputGroupAddon>
      </InputGroup>
    );
  }

  return (
    <InputGroup className="rounded-2xl border-border bg-card">
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
        className="max-h-40 min-h-11 px-3.5 pt-3 text-sm leading-relaxed"
      />

      {/* Actions on their own row: the field keeps the full width, and the
          button sits on a fixed baseline instead of chasing the field's height.
          Ordered after the control in markup so tab order follows reading
          order; `align` handles the visual placement. */}
      <InputGroupAddon align="block-end" className="gap-2 px-2.5 pb-2">
        {/* The one glyph that says "this is the agent", not a search box. It is
            the only decoration on the row; everything else here is an action. */}
        <SparkleIcon
          className="size-4 text-muted-foreground"
          aria-hidden="true"
        />
        {action}
      </InputGroupAddon>
    </InputGroup>
  );
}
