import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'plotly': ['plotly.js-dist-min', 'react-plotly.js'],
          'g6': ['@antv/g6'],
          'echarts': ['echarts', 'echarts-for-react'],
          'react-query': ['@tanstack/react-query'],
          'vendor': ['react', 'react-dom', 'react-router-dom', 'zustand'],
        },
      },
    },
  },
})
