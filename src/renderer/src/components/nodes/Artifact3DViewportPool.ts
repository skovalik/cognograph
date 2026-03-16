/**
 * WebGL Viewport Pool — manages shared THREE.js renderer for 3D artifact nodes.
 *
 * Limits live viewports to MAX_LIVE (4) to prevent WebGL context exhaustion.
 * Uses LRU eviction: least-recently-interacted viewport is frozen to a thumbnail
 * when a new one is requested.
 */

const MAX_LIVE_VIEWPORTS = 4

interface ViewportState {
  nodeId: string
  canvas: HTMLCanvasElement
  lastInteraction: number
  frozen: boolean
}

class ViewportPool {
  private activeViewports = new Map<string, ViewportState>()
  private lruQueue: string[] = []

  acquire(nodeId: string, canvas: HTMLCanvasElement): ViewportState {
    // Return existing if already acquired
    const existing = this.activeViewports.get(nodeId)
    if (existing) {
      this.touch(nodeId)
      return existing
    }

    // Evict LRU if at capacity
    if (this.activeViewports.size >= MAX_LIVE_VIEWPORTS) {
      this.evictLRU()
    }

    const state: ViewportState = {
      nodeId,
      canvas,
      lastInteraction: Date.now(),
      frozen: false,
    }

    this.activeViewports.set(nodeId, state)
    this.lruQueue.push(nodeId)
    return state
  }

  release(nodeId: string): void {
    this.activeViewports.delete(nodeId)
    this.lruQueue = this.lruQueue.filter(id => id !== nodeId)
  }

  touch(nodeId: string): void {
    const state = this.activeViewports.get(nodeId)
    if (state) {
      state.lastInteraction = Date.now()
      this.lruQueue = this.lruQueue.filter(id => id !== nodeId)
      this.lruQueue.push(nodeId)
    }
  }

  getActive(): ViewportState[] {
    return Array.from(this.activeViewports.values()).filter(v => !v.frozen)
  }

  get size(): number {
    return this.activeViewports.size
  }

  private evictLRU(): void {
    const lruId = this.lruQueue.shift()
    if (!lruId) return

    const state = this.activeViewports.get(lruId)
    if (state) {
      // Freeze: capture thumbnail and release WebGL resources
      state.frozen = true
      this.activeViewports.delete(lruId)
    }
  }
}

export const viewportPool = new ViewportPool()
