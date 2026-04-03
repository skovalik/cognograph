import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        external: ['node-pty', 'electron-updater']
      }
    },
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@plugins': resolve('src/plugins')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@plugins': resolve('src/plugins')
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@shared': resolve('src/shared'),
        '@plugins': resolve('src/plugins')
      }
    },
    plugins: [react()],
    css: {
      postcss: './postcss.config.js'
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-dom/client'],
            'zustand-vendor': ['zustand', 'zustand/middleware', 'immer'],
            'reactflow-vendor': ['@xyflow/react'],
            'utility-vendor': ['framer-motion', 'react-markdown', 'react-syntax-highlighter', 'uuid']
          }
        }
      }
    }
  }
})
