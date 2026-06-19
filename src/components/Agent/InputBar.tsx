import { useState } from "react";

/** STUB — full input bar built in step 4. */
export function InputBar({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ask Stash anything..."
        className="flex-1 rounded-xl border border-line bg-card px-3 py-2 text-sm outline-none placeholder:text-muted"
      />
      <button
        type="submit"
        className="rounded-xl bg-emerald px-4 py-2 text-sm font-medium text-bg"
      >
        Send
      </button>
    </form>
  );
}
