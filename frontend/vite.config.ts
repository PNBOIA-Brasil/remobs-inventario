import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          mui: ["@mui/material", "@mui/icons-material"],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    // Telas MUI com muitos eventos passam de 5 s quando a suíte roda em paralelo.
    testTimeout: 20000,
  },
});
