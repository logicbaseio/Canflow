import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 5000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // Local-only convenience: proxy API calls to `vercel dev` (port 3000).
    // Run `vercel dev` in one terminal and `npm run dev` in another, or just
    // use `vercel dev` for the full stack.
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
