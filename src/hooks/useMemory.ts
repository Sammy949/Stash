import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EMPTY_RECALL,
  fetchRecall,
  isMemoryConfigured,
  resolveTenant,
  type MemoryPort,
  type RecallPack,
} from "@/lib/memory";

/**
 * useMemory — the app's handle on Sibyl.
 *
 * Hydrates the recall pack once on mount (the cold-start read) and re-fetches
 * after any turn that wrote memory, so the next prompt already sees what was
 * just learned.
 *
 * `hydrating` is true only while a configured tenant's first read is in flight.
 * It exists so a view can show a "recalling…" state, NEVER so it can hide
 * content: the pack starts as EMPTY_RECALL and is always safe to render, which
 * means an unreachable sidecar degrades to a plain greeting instead of a blank
 * screen.
 *
 * `unreachable` is true when a configured tenant's read finished without an
 * answer. It is the difference between "Stash knows nothing about you" and
 * "Stash cannot reach its memory right now", which matters because the sidecar
 * is hosted somewhere that spins down when idle and takes ~50s to boot. Without
 * it, a cold start renders as the deletion test.
 *
 * `port` is stable across renders and ref-backed, so useAgent can be handed it
 * once instead of threading the pack through every call signature.
 */
export function useMemory() {
  const [recall, setRecall] = useState<RecallPack>(EMPTY_RECALL);
  const [hydrating, setHydrating] = useState<boolean>(isMemoryConfigured());
  const [unreachable, setUnreachable] = useState(false);
  const ref = useRef<RecallPack>(EMPTY_RECALL);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const tenant = resolveTenant();
    if (!tenant) {
      // Memory switched off, or no tenant: not a failure, so not "unreachable".
      ref.current = EMPTY_RECALL;
      if (mounted.current) {
        setRecall(EMPTY_RECALL);
        setHydrating(false);
        setUnreachable(false);
      }
      return;
    }
    const { pack, reachable } = await fetchRecall(tenant);
    ref.current = pack;
    if (mounted.current) {
      setRecall(pack);
      setHydrating(false);
      setUnreachable(!reachable);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const port = useMemo<MemoryPort>(
    () => ({ read: () => ref.current, refresh: load }),
    [load],
  );

  return { recall, hydrating, unreachable, port };
}
