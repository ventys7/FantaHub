import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/assets/dashboard/",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production")
  },
  build: {
    outDir: fileURLToPath(new URL("../assets/dashboard", import.meta.url)),
    emptyOutDir: true,
    minify: "esbuild",
    sourcemap: false,
    cssCodeSplit: false,
    lib: {
      entry: fileURLToPath(new URL("./src/main.tsx", import.meta.url)),
      formats: ["es"],
      fileName: () => "dashboard.js"
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => (
          assetInfo.name?.endsWith(".css") ? "dashboard.css" : "[name][extname]"
        )
      }
    }
  }
});
