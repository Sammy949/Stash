import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Geist — the "Financial Intelligence" type system. Geist Mono is reserved for
// monetary/data figures and system-status labels (tabular-nums); self-hosted so
// the demo renders identically offline.
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
