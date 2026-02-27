import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    open: false,
    watch: {
      usePolling: true,
      interval: 500
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three")) {
            return "three-vendor";
          }
          if (id.includes("node_modules")) {
            return "react-vendor";
          }
          return undefined;
        }
      }
    }
  }
});
