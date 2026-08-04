import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;
const staging = process.env.VITE_TERMINAL_STAGING === "true";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(async () => ({
  plugins: [react()],
  base: process.env.TAURI_ENV_PLATFORM
    ? "/"
    : (staging
        ? "/terminal/staging/"
        : (process.env.VITE_TERMINAL_EDITION === "ru" ? "/ru/terminal/" : "/terminal/")),
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  resolve: {
    alias: staging
      ? {
          "@tauri-apps/api/core": path.resolve(__dirname, "src/lib/web_staging_invoke.ts"),
        }
      : {},
  },
  build: {
    target:
      process.env.TAURI_ENV_PLATFORM === "windows"
        ? "chrome105"
        : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    rollupOptions: {
      ...(staging ? { input: path.resolve(__dirname, "index.staging.html") } : {}),
      output: {
        manualChunks(id) {
          if (id.includes("LocalReportingPanel")) return "mod-reporting";
          if (id.includes("IntakeForm")) return "mod-reception";
          if (id.includes("WorkLogPanel")) return "mod-consultation";
          if (id.includes("IprExportPanel")) return "mod-ipr";
          if (id.includes("ConsumerBridgePanel")) return "mod-consumer";
          if (id.includes("InboxPanel")) return "mod-inbox";
          if (id.includes("ManagerAdminPanel")) return "mod-manager";
          if (id.includes("DashboardRollupPanel")) return "mod-rollup";
          if (id.includes("AiModesPanel")) return "mod-ai";
          if (id.includes("DocumentUploadPanel")) return "mod-documents";
        },
      },
    },
  },
}));
