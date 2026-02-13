import { describe, it, expect, vi } from 'vitest'
import { mockElectronApi, resetElectronApiMocks } from './mocks/electronApi'

/**
 * Infrastructure tests to verify the test setup is working correctly.
 * These tests validate that mocks, globals, and test utilities are properly configured.
 */
describe('Test Infrastructure', () => {
  describe('window.api mock', () => {
    it('should have window.api defined', () => {
      expect(window.api).toBeDefined()
    })

    it('should have all API namespaces', () => {
      expect(window.api.workspace).toBeDefined()
      expect(window.api.settings).toBeDefined()
      expect(window.api.llm).toBeDefined()
      expect(window.api.templates).toBeDefined()
      expect(window.api.dialog).toBeDefined()
      expect(window.api.artifact).toBeDefined()
      expect(window.api.aiEditor).toBeDefined()
      expect(window.api.agent).toBeDefined()
      expect(window.api.attachment).toBeDefined()
      expect(window.api.connector).toBeDefined()
      expect(window.api.multiplayer).toBeDefined()
      expect(window.api.backup).toBeDefined()
    })

    it('should return mock values from workspace API', async () => {
      const result = await window.api.workspace.save({ test: 'data' })
      expect(result).toEqual({ success: true })
    })

    it('should track calls with vi.fn()', async () => {
      await window.api.workspace.load('test-id')
      expect(mockElectronApi.workspace.load).toHaveBeenCalledWith('test-id')
    })
  })

  describe('Browser API mocks', () => {
    it('should have ResizeObserver defined', () => {
      expect(global.ResizeObserver).toBeDefined()
      const observer = new ResizeObserver(() => {})
      expect(observer.observe).toBeDefined()
      expect(observer.disconnect).toBeDefined()
    })

    it('should have IntersectionObserver defined', () => {
      expect(global.IntersectionObserver).toBeDefined()
    })

    it('should have matchMedia defined', () => {
      expect(window.matchMedia).toBeDefined()
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      expect(mq.matches).toBe(false)
    })
  })

  describe('Mock reset utility', () => {
    it('should reset all mocks', async () => {
      // Make some calls
      await mockElectronApi.workspace.save({ data: 1 })
      await mockElectronApi.settings.get('key')

      // Verify calls were tracked
      expect(mockElectronApi.workspace.save).toHaveBeenCalled()
      expect(mockElectronApi.settings.get).toHaveBeenCalled()

      // Reset mocks
      resetElectronApiMocks()

      // Verify mocks are reset
      expect(mockElectronApi.workspace.save).not.toHaveBeenCalled()
      expect(mockElectronApi.settings.get).not.toHaveBeenCalled()
    })
  })

  describe('Vitest globals', () => {
    it('should have describe, it, expect available globally', () => {
      expect(typeof describe).toBe('function')
      expect(typeof it).toBe('function')
      expect(typeof expect).toBe('function')
    })

    it('should have vi utilities available', () => {
      expect(vi.fn).toBeDefined()
      expect(vi.spyOn).toBeDefined()
      expect(vi.mock).toBeDefined()
    })
  })
})
