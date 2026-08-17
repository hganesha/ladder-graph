import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["schema/lgir-v1alpha1.schema.json", "icon-light.png", "icon-dark.png"],
      manifest: {
        name: "Ladder Graph",
        short_name: "Ladder",
        description: "A local-first visual compiler for agent workflows.",
        theme_color: "#0a0d10",
        background_color: "#0a0d10",
        display: "standalone",
        start_url: "/",
        icons: [{ src: "/icon-dark.png", sizes: "680x680", type: "image/png", purpose: "any maskable" }],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,wasm,json,svg,png,woff2}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: "/index.html",
        runtimeCaching: [],
      },
    }),
  ],
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local", "localhost", "127.0.0.1"],
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
  worker: {
    format: "es",
  },
});
