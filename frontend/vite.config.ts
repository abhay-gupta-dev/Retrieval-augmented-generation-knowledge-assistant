import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Accept requests consistently through both localhost and 127.0.0.1.
    // Google OAuth returns to FRONTEND_URL, which is 127.0.0.1 in local setup.
    host: "0.0.0.0",
    strictPort: true,
    proxy: {
      "/api": "http://127.0.0.1:8000",
      "/health": "http://127.0.0.1:8000",
    },
  },
});
