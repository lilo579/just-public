import { defineConfig } from "astro/config";
import node from "@astrojs/node";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),

  vite: {
    server: {
      // Allow Host-header simulation for any tenant domain in local SSR.
      // Prefer `/?host=<domain>` when possible — no per-tenant allowlist.
      allowedHosts: true,
    },
  },
});