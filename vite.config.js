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
        shipbuildingQc: resolve(__dirname, "tools/joseon-bbox-qc/index.html"),
        shipbuildingQcApp: resolve(__dirname, "tools/joseon-bbox-qc/app.html")
      }
    }
  }
});
