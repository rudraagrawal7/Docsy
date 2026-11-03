import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/* pdf-lib and pdf.js are only reachable through dynamic import() in
   src/tools.ts and src/pages/ToolPage.tsx, so Rollup splits the PDF engine
   into its own chunks. No manualChunks needed — forcing them created an
   eager shared-module edge that pulled pdf-lib into the landing page. */
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600,
  },
})
