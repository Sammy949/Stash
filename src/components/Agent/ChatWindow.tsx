import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/types";
import { MessageBubble } from "./MessageBubble";
import { QuickChips } from "./QuickChips";
import { InputBar } from "./InputBar";

export function ChatWindow({
  messages,
  onSend,
  isThinking = false,
}: {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  isThinking?: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  // Smooth-scroll to the latest message whenever the transcript changes.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-line bg-card">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-line px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald/30 bg-emerald/10">
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-emerald">
            <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.75" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
          </svg>
        </div>
        <div>
          <h2 className="text-sm font-semibold leading-none">Stash AI</h2>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald" />
            <span className="text-[11px] text-muted">Active</span>
          </div>
        </div>
        <span className="ml-auto rounded-full border border-line px-2 py-1 text-[10px] font-medium text-muted">
          ⚡ 0G powered
        </span>
      </div>

      {/* Transcript */}
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div className="space-y-3 border-t border-line px-5 py-4">
        <QuickChips onPick={onSend} disabled={isThinking} />
        <InputBar onSend={onSend} disabled={isThinking} />
        <p className="text-center text-[11px] text-muted">
          Powered by 0G Compute
        </p>
      </div>
    </div>
  );
}
