import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Owlbear carica il manifest da localhost durante lo sviluppo.
    cors: { origin: "https://www.owlbear.rodeo" },
  },
  build: {
    rollupOptions: {
      input: { app: "index.html", background: "background.html" },
    },
  },
});
