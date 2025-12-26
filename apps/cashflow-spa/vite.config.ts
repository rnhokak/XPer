import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const normalizeBasePath = (value: string | undefined) => {
  const raw = value && value.trim() ? value.trim() : "/app/cashflow";
  return raw.endsWith("/") ? raw : `${raw}/`;
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = normalizeBasePath(env.VITE_BASE_PATH);
  const apiTarget = env.VITE_API_BASE_URL || "http://localhost:3005";

  return {
    base,
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
        "/auth": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
