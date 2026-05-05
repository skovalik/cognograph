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
    // Pre-bundle deps that are reachable only through React.lazy / dynamic imports.
    // Without this, Vite discovers them on first lazy-load, triggers a re-optimization,
    // and invalidates any in-flight import URLs with a 504 "Outdated Optimize Dep".
    // Symptom: blank canvas after enabling Plasma effect or first opening a conversation
    // node with a terminal. Affects xterm (TerminalPanel), ogl (6 shader effects), and
    // three/r3f (7 shader effects).
    optimizeDeps: {
      include: [
        '@xterm/xterm',
        '@xterm/addon-fit',
        '@xterm/addon-unicode11',
        '@xterm/addon-webgl',
        'ogl',
        'three',
        'three/src/math/MathUtils.js',
        '@react-three/fiber',
        '@react-three/drei',
        '@react-three/postprocessing',
        'postprocessing'
      ]
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
