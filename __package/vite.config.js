import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc"; // or switch to '@vitejs/plugin-react' if you don’t need SWC
import { resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist-react",
    rollupOptions: {
      input: "index.html",
      external: [
        "pdfjs-dist/build/pdf.worker.min.js"
      ],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      lib: resolve(__dirname, "src/app/lib"),
      components: resolve(__dirname, "src/app/components"),
      "resume-parser": resolve(__dirname, "src/app/resume-parser"),
      "resume-import": resolve(__dirname, "src/app/resume-import"),
      home: resolve(__dirname, "src/app/home"),
      data: resolve(__dirname, "src/app/data"),
    },
    extensions: [".mjs", ".js", ".ts", ".jsx", ".tsx", ".json"], // ✅ include both configs' extensions
  },
}));
