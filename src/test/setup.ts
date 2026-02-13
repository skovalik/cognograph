import '@testing-library/jest-dom'
import { vi } from 'vitest'
import { mockElectronApi } from './mocks/electronApi'

// Mock window.api globally for all tests
Object.defineProperty(window, 'api', {
  value: mockElectronApi,
  writable: true
})

// Mock ResizeObserver (not available in jsdom)
class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver

// Mock IntersectionObserver (not available in jsdom)
class MockIntersectionObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  root = null
  rootMargin = ''
  thresholds = []
  takeRecords = vi.fn().mockReturnValue([])
}
global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver

// Mock matchMedia (not available in jsdom)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
})

// Mock scrollTo (not available in jsdom)
Element.prototype.scrollTo = vi.fn()
window.scrollTo = vi.fn()

// Suppress console errors in tests unless explicitly needed
// Uncomment the following line to silence noisy console output during tests:
// vi.spyOn(console, 'error').mockImplementation(() => {})
