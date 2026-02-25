import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'out'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', 'dist', 'out', 'src/test/**'],
      thresholds: {
        statements: 5,
        branches: 5,
        functions: 5,
        lines: 5
      }
    }
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, './src/shared'),
      '@renderer': resolve(__dirname, './src/renderer/src'),
      '@/lib/utils': resolve(__dirname, './src/renderer/src/lib/utils'),
      '@': resolve(__dirname, './src/renderer/src'),
      // Stub for node-pty (native module not yet installed).
      // Tests use vi.mock('node-pty') to replace this with a proper mock.
      'node-pty': resolve(__dirname, './src/main/services/__mocks__/node-pty.ts')
    }
  }
})
