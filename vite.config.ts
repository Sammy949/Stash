import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
});
