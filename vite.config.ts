import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/app-icon.svg", "icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "Open Workout AI",
        short_name: "Workout AI",
        description: "Local-first workout execution from prescription to validated record",
        theme_color: "#000000",
        background_color: "#000000",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "/",
        scope: "/",
        lang: "en",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,json}"],
        globIgnores: ["data/history-v1.json", "data/prescription-v1.json"],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true
      },
      devOptions: { enabled: true }
    })
  ],
  server: { host: "127.0.0.1", port: 4174 },
  preview: { host: "127.0.0.1", port: 4174 }
});
