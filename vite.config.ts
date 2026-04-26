import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        app: resolve(__dirname, "index.html"),
        sidepanel: resolve(__dirname, "sidepanel.html"),
        "model-scanner": resolve(__dirname, "src/extension/model-scanner.ts"),
        "file-scanner": resolve(__dirname, "src/extension/file-scanner.ts"),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === "model-scanner" || chunk.name === "file-scanner"
            ? `extension/${chunk.name}.js`
            : "assets/[name]-[hash].js",
      },
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
