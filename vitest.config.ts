import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // Großzügiger als der 5s-Default: die jsdom-Umgebung ist auf langsamen/
    // ausgelasteten Windows-Maschinen zäh, sonst gibt es sporadische Timeouts.
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
