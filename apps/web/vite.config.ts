import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:3001'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/uploads': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React 核心 — 几乎不变，长期缓存
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // 流程图引擎 — 独立缓存
          'flow-vendor': ['@xyflow/react'],
          // 图标库 — 按需引用但体积大
          'icon-vendor': ['lucide-react'],
          // 工具库
          'util-vendor': ['axios', 'zustand'],
        },
      },
    },
  },
})
