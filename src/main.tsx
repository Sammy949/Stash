import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { initAnalytics } from "./lib/analytics.ts";
import { initSentry } from "./lib/sentry.ts";
import "./index.css";

initSentry();
initAnalytics();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
