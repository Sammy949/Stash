import type { ChatMessage } from "@/types";
import { MessageBubble } from "./MessageBubble";
import { QuickChips } from "./QuickChips";
import { InputBar } from "./InputBar";

/** STUB — full chat window (header, scroll, typing) built in step 4. */
export function ChatWindow({
  messages,
  onSend,
}: {
  messages: ChatMessage[];
  onSend: (text: string) => void;
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-line bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-emerald" />
        <h2 className="text-sm font-medium">Stash AI</h2>
        <span className="ml-auto text-xs text-muted">0G powered</span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
      </div>

      <div className="mt-4 space-y-3">
        <QuickChips onPick={onSend} />
        <InputBar onSend={onSend} />
        <p className="text-center text-[11px] text-muted">
          Powered by 0G Compute
        </p>
      </div>
    </div>
  );
}
