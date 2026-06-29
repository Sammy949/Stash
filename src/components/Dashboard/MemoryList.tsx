import { useState } from "react";
import type { Memory, MemoryKind } from "@/types";
import { MemoryIcon, CheckIcon, CloseIcon, PencilIcon, TrashIcon } from "@/components/UI/icons";
import { RowButton } from "@/components/UI/RowButton";

/** Kinds in display order with their group headings (matches the prompt). */
const GROUPS: { kind: MemoryKind; heading: string }[] = [
  { kind: "goal", heading: "Goals" },
  { kind: "habit", heading: "Habits" },
  { kind: "preference", heading: "Preferences" },
  { kind: "opportunity", heading: "Opportunities" },
  { kind: "identity", heading: "About you" },
];

/**
 * "What Stash Remembers" — the visible proof that memory exists and persists.
 * The soft counterpart to the transaction list: goals, habits, preferences
 * Stash has learned from conversation, grouped by kind, each editable and
 * deletable. Memory shapes advice but never the numbers, so edits here don't
 * touch the balance.
 */
export function MemoryList({
  memories,
  onEdit,
  onDelete,
}: {
  memories: Memory[];
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  function startEdit(m: Memory) {
    setConfirmId(null);
    setEditingId(m.id);
    setDraft(m.content);
  }

  function saveEdit(id: string) {
    onEdit(id, draft);
    setEditingId(null);
  }

  function renderRow(m: Memory) {
    // ── Editing ──
    if (editingId === m.id) {
      return (
        <li key={m.id} className="flex items-center gap-2 rounded-xl bg-bg/40 px-2 py-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-2 py-1 text-sm text-ink outline-none focus:border-emerald"
          />
          <RowButton label="Save changes" tone="emerald" onClick={() => saveEdit(m.id)}>
            <CheckIcon className="h-4 w-4" />
          </RowButton>
          <RowButton label="Cancel" onClick={() => setEditingId(null)}>
            <CloseIcon className="h-4 w-4" />
          </RowButton>
        </li>
      );
    }

    // ── Delete confirm ──
    if (confirmId === m.id) {
      return (
        <li key={m.id} className="flex items-center gap-2 rounded-xl bg-red/5 px-2 py-2.5">
          <span className="min-w-0 flex-1 truncate text-sm text-muted">Forget this?</span>
          <RowButton
            label="Confirm forget"
            tone="red"
            onClick={() => {
              onDelete(m.id);
              setConfirmId(null);
            }}
          >
            <CheckIcon className="h-4 w-4" />
          </RowButton>
          <RowButton label="Keep" onClick={() => setConfirmId(null)}>
            <CloseIcon className="h-4 w-4" />
          </RowButton>
        </li>
      );
    }

    // ── Default ──
    return (
      <li
        key={m.id}
        className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-bg/40"
      >
        <span className="min-w-0 flex-1 text-sm text-ink">{m.content}</span>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <RowButton label="Edit" onClick={() => startEdit(m)}>
            <PencilIcon className="h-4 w-4" />
          </RowButton>
          <RowButton
            label="Forget"
            tone="red"
            onClick={() => {
              setEditingId(null);
              setConfirmId(m.id);
            }}
          >
            <TrashIcon className="h-4 w-4" />
          </RowButton>
        </div>
      </li>
    );
  }

  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">What Stash Remembers</h2>
        <MemoryIcon className="h-4 w-4 text-emerald" />
      </div>

      {memories.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line px-3 py-4 text-center text-xs text-muted">
          Nothing learned yet. Tell Stash your goals, habits, or preferences in
          chat — “I’m saving for a laptop”, “I usually cook” — and they’ll show up
          here.
        </p>
      ) : (
        <div className="mt-3 space-y-4">
          {GROUPS.map(({ kind, heading }) => {
            const items = memories.filter((m) => m.kind === kind);
            if (items.length === 0) return null;
            return (
              <div key={kind}>
                <p className="px-2 text-[11px] font-medium uppercase tracking-wide text-muted">
                  {heading}
                </p>
                <ul className="mt-1 space-y-0.5">{items.map(renderRow)}</ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
