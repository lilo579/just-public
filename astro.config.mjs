import { defineConfig } from "astro/config";
import node from "@astrojs/node";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),

  vite: {
    server: {
      allowedHosts: [
        "localhost",
        "127.0.0.1",
        "www.3djewish.com.br",
        "www.marceloborer.com.br", // 👈 adicionar aqui
        "nao-existe.com.br",
      ],
    },
  },
});