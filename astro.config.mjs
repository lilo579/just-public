import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  output: "server",
  // passthrough: avoid bundling sharp into the Worker (nodejs_compat not enabled in Slice 1).
  adapter: cloudflare({ imageService: "passthrough" }),

  vite: {
    server: {
      // Allow Host-header simulation for any tenant domain in local SSR.
      // Prefer `/?host=<domain>` when possible — no per-tenant allowlist.
      allowedHosts: true,
    },
  },
});
