import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  root: "client",
  publicDir: "public",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    sourcemap: false,
    target: "es2022",
    chunkSizeWarningLimit: 700,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8081",
      "/uploads": "http://localhost:8081",
      "/health": "http://localhost:8081",
      "/ws": { target: "ws://localhost:8081", ws: true },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.png", "logo.png", "robots.txt"],
      manifest: {
        id: "/",
        name: "DTEmpire Adventure",
        short_name: "DTEmpire",
        description: "A multiplayer card-table RPG. Climb the Tower, delve the Dungeon, hatch pets and duel your friends.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        display_override: ["window-controls-overlay", "standalone"],
        orientation: "any",
        background_color: "#0b1020",
        theme_color: "#0b1020",
        categories: ["games", "entertainment"],
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
        shortcuts: [
          { name: "Adventure", url: "/adventure", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
          { name: "Daily rewards", url: "/quests", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
          { name: "Tower", url: "/tower", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
        ],
      },
      workbox: {
        // Precache the shell plus the Latin font subsets the UI actually uses; other subsets stay on demand.
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}", "assets/*latin-*.woff2"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/ws/, /^\/uploads\//, /^\/health/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/uploads/"),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "avatars", expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
          {
            // Last-known game state so the installed app opens with your hero while offline.
            urlPattern: ({ url, request }) => request.method === "GET" && ["/api/me", "/api/inventory", "/api/pets", "/api/tower", "/api/adventure", "/api/achievements", "/api/bestiary"].includes(url.pathname),
            handler: "NetworkFirst",
            options: { cacheName: "api-snapshots", networkTimeoutSeconds: 4, expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 7 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
