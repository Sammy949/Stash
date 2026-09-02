import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { execSync } from "node:child_process";
import path from "node:path";

/**
 * Short commit hash of the build, surfaced in the UI next to a live clock.
 * The hackathon's recall beat has to be one continuous unedited take, and a
 * constant SHA beside a running clock is what makes that visible on camera.
 */
function buildSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "dev"; // building outside a git checkout (e.g. a source tarball)
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load EVERY env var, not just VITE_*: the dev proxy needs the memory
  // sidecar's service token, and a VITE_ variable would be inlined into the
  // client bundle. This is read in the Node dev server and injected as a
  // request header, so the browser never holds it, dev or prod.
  const env = loadEnv(mode, process.cwd(), "");
  const svcUrl = (env.SIBYL_SVC_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
  const svcToken = env.SIBYL_SVC_TOKEN || "";
  const proxyHeaders: Record<string, string> = svcToken
    ? { Authorization: `Bearer ${svcToken}` }
    : {};

  return {
    plugins: [react(), tailwindcss()],
    define: {
      __BUILD_SHA__: JSON.stringify(buildSha()),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // ethers and the 0G SDK are loaded via dynamic import() in ogStorage.ts
    // (to keep the initial bundle small). Pre-bundle them at dev startup so
    // the first "Sync to 0G" doesn't trigger a mid-session Vite re-optimize,
    // which invalidates the module graph and breaks the in-flight import
    // ("Failed to fetch dynamically imported module: .../ethers.js").
    optimizeDeps: {
      include: ["ethers", "@0gfoundation/0g-storage-ts-sdk"],
    },
    server: {
      proxy: {
        // Dev stand-in for api/memory.ts (the Vercel function): same ?path=
        // contract, same server-side token injection, so the client code path
        // is identical locally and in production.
        "/api/memory": {
          target: svcUrl,
          changeOrigin: true,
          headers: proxyHeaders,
          rewrite: (url) => {
            const q = new URLSearchParams(url.split("?")[1] ?? "");
            const sidecarPath = q.get("path") ?? "";
            q.delete("path");
            const rest = q.toString();
            return `/${sidecarPath}${rest ? `?${rest}` : ""}`;
          },
        },
      },
    },
  };
});
