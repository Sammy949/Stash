import { useEffect, useState } from "react";
import { fetchGoalNotes, isMemoryConfigured, memoryDisabled } from "@/lib/memory";

/**
 * The remembered reasons behind one goal's history.
 *
 * A goal's timeline is assembled from two halves that fail independently: the
 * ledger's own events (what and when — always present, offline, restored from
 * the ledger) and these notes (why — written by the model into Sibyl's COLD
 * journal). This hook fetches the second half only.
 *
 * It therefore NEVER gates rendering. The caller draws every row from the
 * ledger the moment the detail opens and lets the notes arrive into rows that
 * already exist, so a slow or missing memory service costs the reason and
 * nothing else. `available` is false when memory is switched off or was never
 * configured, which the view says out loud rather than quietly showing a
 * history that looks thinner than it is.
 */
export function useGoalMemory(goalId: string | null) {
  const [notes, setNotes] = useState<Map<string, string>>(new Map());
  const available = isMemoryConfigured() && !memoryDisabled();

  useEffect(() => {
    // Every open starts from nothing, so one goal's reasons can never be shown
    // against another goal's rows while the new read is still in flight.
    setNotes(new Map());
    if (!goalId || !available) return;

    const controller = new AbortController();
    let live = true;
    void fetchGoalNotes(goalId, controller.signal).then((found) => {
      if (live) setNotes(found);
    });
    return () => {
      live = false;
      controller.abort();
    };
  }, [goalId, available]);

  return { notes, available };
}
