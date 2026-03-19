/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
    dedupe: ['three'],
  },
  server: {
    port: Number(process.env.VITE_PORT) || 5173,
    host: true,
    proxy: {
      '/socket.io': {
        target: `http://localhost:7860`,
        ws: true,
        changeOrigin: true,
      },
      '/api': {
        target: `http://localhost:7860`,
        changeOrigin: true,
      },
    },
    headers: {
      // Relaxed headers for Hugging Face iframe compatibility
    },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 5000,
    minify: false, // TEMPORARY: Disable minification for better debugging
    rollupOptions: {
      output: {
        // manualChunks removed to let Vite handle splitting automatically
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'three', '@react-three/fiber', '@react-three/drei', 'zustand', '@dimforge/rapier3d-compat'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/vitest.setup.ts'],
    exclude: ['node_modules', 'dist', 'deploy_hf/**'],
  },
})
