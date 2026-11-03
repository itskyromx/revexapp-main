import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig(({ command, mode }) => {
  if (command === "build") {
    const env = loadEnv(mode, process.cwd(), "VITE_");
    const missing = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"]
      .filter(name => !env[name]?.trim());
    if (missing.length) {
      throw new Error(`Missing build variables: ${missing.join(", ")}. Configure them in Cloudflare Settings > Build > Build variables and secrets, then rebuild.`);
    }
  }
  return {
  plugins: [react(), ...(command === "build" ? [cloudflare()] : [])],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  };
});
