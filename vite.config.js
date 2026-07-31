import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        aiProfile: resolve(__dirname, "ai-profile.html"),
        labelingQa: resolve(__dirname, "labeling-qa.html"),
        shop: resolve(__dirname, "shop.html"),
        tools: resolve(__dirname, "tools/index.html"),
        toolsApp: resolve(__dirname, "tools/app.html"),
        legacyBboxQc: resolve(__dirname, "tools/bbox-qc/index.html"),
        legacyBboxQcApp: resolve(__dirname, "tools/bbox-qc/app.html")
      }
    }
  }
});
