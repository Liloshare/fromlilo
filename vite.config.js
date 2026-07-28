import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        shipbuildingQc: resolve(__dirname, "tools/joseon-bbox-qc/index.html")
      }
    }
  }
});
