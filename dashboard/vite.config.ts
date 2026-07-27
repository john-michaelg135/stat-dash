import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2020",
    outDir: process.env.VERCEL ? "../dist" : "dist",
    minify: "esbuild",
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          charts: ["recharts"],
          duckdb: ["@duckdb/duckdb-wasm"],
        },
      },
    },
  },
});
