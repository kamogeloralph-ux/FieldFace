import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { defineConfig } from "vite";

const projectRoot = import.meta.dirname;
const clientRoot = path.resolve(projectRoot, "client");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(clientRoot, "src"),
      "@shared": path.resolve(projectRoot, "shared"),
    },
  },
  envDir: projectRoot,
  root: clientRoot,
  publicDir: path.resolve(clientRoot, "public"),
  build: {
    outDir: path.resolve(projectRoot, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(clientRoot, "index.html"),
        admin: path.resolve(clientRoot, "admin.html"),
      },
    },
  },
  server: {
    host: true,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
