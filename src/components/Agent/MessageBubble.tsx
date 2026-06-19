import type { ChatMessage } from "@/types";

/** STUB — styled bubbles + avatar + typing dots built in step 4. */
export function MessageBubble({ message }: { message: ChatMessage }) {
  const mine = message.role === "user";
  return (
    <div className={mine ? "text-right" : "text-left"}>
      <p className="inline-block rounded-xl bg-slate px-3 py-2 text-sm">
        {message.content}
      </p>
    </div>
  );
}
