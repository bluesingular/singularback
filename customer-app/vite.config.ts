import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Gap H — PWA: manifest + service worker for mobile approval flow
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png"],
      manifest: {
        name: "Swwarm",
        short_name: "Swwarm",
        description: "Votre équipe IA — approuvez, déléguez, gérez depuis votre téléphone.",
        theme_color: "#1A9E68",
        background_color: "#FAFAF8",
        display: "standalone",
        orientation: "portrait",
        start_url: "/tableau-de-bord",
        scope: "/",
        lang: "fr",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
        shortcuts: [
          {
            name: "Approbations",
            url: "/approbations",
            description: "Voir les actions en attente",
          },
          {
            name: "Console CEO",
            url: "/console-ceo",
            description: "Ouvrir la console",
          },
        ],
      },
      workbox: {
        // Cache API responses for approvals + agents for offline resilience
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\/v1\/companies\/.*\/approvals/,
            handler: "NetworkFirst",
            options: {
              cacheName: "approvals-cache",
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
          {
            urlPattern: /^https?:\/\/.*\/api\/v1\/companies\/.*\/agents/,
            handler: "NetworkFirst",
            options: {
              cacheName: "agents-cache",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 },
            },
          },
        ],
        // Always serve app shell from cache (offline shell)
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/],
      },
      devOptions: {
        enabled: false, // disable in dev to avoid SSE conflicts
      },
    }),
  ],
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: "http://localhost:3100",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
