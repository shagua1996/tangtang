import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
export default defineConfig({
  plugins: [vue()],
  base: './',
  build: {
    target: 'chrome108',
    cssTarget: 'chrome108',
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
  },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
})
