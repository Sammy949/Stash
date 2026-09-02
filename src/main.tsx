import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { IconContext } from "@phosphor-icons/react";
// Geist — the "Financial Intelligence" type system. Geist Mono is reserved for
// monetary/data figures and system-status labels (tabular-nums); self-hosted so
// the demo renders identically offline.
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import App from "./App.tsx";
import "./index.css";

/**
 * One weight for every icon in the app, set once.
 *
 * `fill` is the house weight. Size defaults to 1em so an icon rendered without a
 * sizing class still has an intrinsic size rather than collapsing. Any single
 * icon can override either by passing the prop itself.
 *
 * This also covers the vendored shadcn components: their lucide imports are
 * aliased to the phosphor shim, so they inherit from here too.
 */
const ICON_DEFAULTS = { weight: "fill", size: "1em" } as const;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <IconContext.Provider value={ICON_DEFAULTS}>
      <App />
    </IconContext.Provider>
  </StrictMode>,
);
