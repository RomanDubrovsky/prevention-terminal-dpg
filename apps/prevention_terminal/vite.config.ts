import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;
const staging = process.env.VITE_TERMINAL_STAGING === "true";
const idaWeb = process.env.VITE_IDA_AUTH_MODE === "supabase";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(async () => ({
  plugins: [react()],
  base: process.env.TAURI_ENV_PLATFORM
    ? "/"
    : (idaWeb
        ? "/"
        : (staging
            ? "/terminal/staging/"
            : (process.env.VITE_TERMINAL_EDITION === "ru" ? "/ru/terminal/" : "/terminal/"))),
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
    alias: (staging || idaWeb)
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
      ...(idaWeb
        ? { input: path.resolve(__dirname, "index.ida-web.html") }
        : (staging ? { input: path.resolve(__dirname, "index.staging.html") } : {})),
    },
  },
}));
