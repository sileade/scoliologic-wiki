import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
import { visualizer } from "rollup-plugin-visualizer";

const plugins = [
  react(),
  tailwindcss(),
  jsxLocPlugin(),
  vitePluginManusRuntime(),
  // Визуализатор бандла (генерирует stats.html при сборке)
  visualizer({
    filename: "dist/stats.html",
    open: false,
    gzipSize: true,
    brotliSize: true,
  }),
];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Оптимизация разделения чанков
    rollupOptions: {
      output: {
        manualChunks: {
          // Выделяем React и связанные библиотеки в отдельный чанк
          "vendor-react": ["react", "react-dom", "wouter"],
          // UI компоненты
          "vendor-ui": ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-tabs"],
          // TipTap редактор
          "vendor-editor": ["@tiptap/react", "@tiptap/starter-kit", "@tiptap/core"],
          // Chart.js
          "vendor-charts": ["chart.js"],
        },
      },
    },
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
