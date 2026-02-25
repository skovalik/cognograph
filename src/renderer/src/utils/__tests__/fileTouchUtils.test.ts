import { describe, it, expect } from 'vitest'
import {
  generateFileTouchEdges,
  detectFileConflicts,
  getFileTouchEdgeStyle,
  isFileTouchEdge
} from '../fileTouchUtils'
import type { FileTouchRecord } from '../fileTouchTypes'

describe('generateFileTouchEdges', () => {
  it('creates edge for each touch record with matching artifact node', () => {
    const records: FileTouchRecord[] = [
      {
        filePath: '/src/app.ts',
        sessionId: 's1',
        nodeId: 'conv-1',
        accentColor: '#FF6B35',
        lastTouchedAt: 1000
      }
    ]
    const artifactMap = new Map([['/src/app.ts', 'art-1']])
    const edges = generateFileTouchEdges(records, artifactMap)
    expect(edges).toHaveLength(1)
    expect(edges[0].source).toBe('conv-1')
    expect(edges[0].target).toBe('art-1')
    expect(edges[0].data.isFileTouchEdge).toBe(true)
    expect(edges[0].data.sessionAccentColor).toBe('#FF6B35')
  })

  it('skips records without matching artifact node on canvas', () => {
    const records: FileTouchRecord[] = [
      {
        filePath: '/src/missing.ts',
        sessionId: 's1',
        nodeId: 'conv-1',
        accentColor: '#FF6B35',
        lastTouchedAt: 1000
      }
    ]
    const artifactMap = new Map<string, string>()
    const edges = generateFileTouchEdges(records, artifactMap)
    expect(edges).toHaveLength(0)
  })

  it('creates multiple edges for multiple sessions touching different files', () => {
    const records: FileTouchRecord[] = [
      {
        filePath: '/src/a.ts',
        sessionId: 's1',
        nodeId: 'conv-1',
        accentColor: '#FF6B35',
        lastTouchedAt: 1000
      },
      {
        filePath: '/src/b.ts',
        sessionId: 's2',
        nodeId: 'conv-2',
        accentColor: '#4ECDC4',
        lastTouchedAt: 2000
      }
    ]
    const artifactMap = new Map([
      ['/src/a.ts', 'art-a'],
      ['/src/b.ts', 'art-b']
    ])
    const edges = generateFileTouchEdges(records, artifactMap)
    expect(edges).toHaveLength(2)
  })

  it('returns empty array for empty records', () => {
    const edges = generateFileTouchEdges([], new Map())
    expect(edges).toHaveLength(0)
  })

  it('edge data has visible=true by default', () => {
    const records: FileTouchRecord[] = [
      {
        filePath: '/src/app.ts',
        sessionId: 's1',
        nodeId: 'conv-1',
        accentColor: '#FF6B35',
        lastTouchedAt: 1000
      }
    ]
    const artifactMap = new Map([['/src/app.ts', 'art-1']])
    const edges = generateFileTouchEdges(records, artifactMap)
    expect(edges[0].data.visible).toBe(true)
  })

  it('preserves filePath and sessionId in edge data', () => {
    const records: FileTouchRecord[] = [
      {
        filePath: '/src/app.ts',
        sessionId: 's1',
        nodeId: 'conv-1',
        accentColor: '#FF6B35',
        lastTouchedAt: 1000
      }
    ]
    const artifactMap = new Map([['/src/app.ts', 'art-1']])
    const edges = generateFileTouchEdges(records, artifactMap)
    expect(edges[0].data.filePath).toBe('/src/app.ts')
    expect(edges[0].data.sessionId).toBe('s1')
  })
})

describe('detectFileConflicts', () => {
  it('returns conflict when 2+ sessions touch same file', () => {
    const records: FileTouchRecord[] = [
      {
        filePath: '/src/shared.ts',
        sessionId: 's1',
        nodeId: 'conv-1',
        accentColor: '#FF6B35',
        lastTouchedAt: 1000
      },
      {
        filePath: '/src/shared.ts',
        sessionId: 's2',
        nodeId: 'conv-2',
        accentColor: '#4ECDC4',
        lastTouchedAt: 2000
      }
    ]
    const conflicts = detectFileConflicts(records)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].filePath).toBe('/src/shared.ts')
    expect(conflicts[0].sessions).toHaveLength(2)
  })

  it('returns empty for single session per file', () => {
    const records: FileTouchRecord[] = [
      {
        filePath: '/src/a.ts',
        sessionId: 's1',
        nodeId: 'conv-1',
        accentColor: '#FF6B35',
        lastTouchedAt: 1000
      },
      {
        filePath: '/src/b.ts',
        sessionId: 's2',
        nodeId: 'conv-2',
        accentColor: '#4ECDC4',
        lastTouchedAt: 2000
      }
    ]
    const conflicts = detectFileConflicts(records)
    expect(conflicts).toHaveLength(0)
  })

  it('deduplicates same session touching same file twice', () => {
    const records: FileTouchRecord[] = [
      {
        filePath: '/src/app.ts',
        sessionId: 's1',
        nodeId: 'conv-1',
        accentColor: '#FF6B35',
        lastTouchedAt: 1000
      },
      {
        filePath: '/src/app.ts',
        sessionId: 's1',
        nodeId: 'conv-1',
        accentColor: '#FF6B35',
        lastTouchedAt: 2000
      }
    ]
    const conflicts = detectFileConflicts(records)
    expect(conflicts).toHaveLength(0) // Only 1 unique session
  })

  it('handles 3+ sessions conflicting on one file', () => {
    const records: FileTouchRecord[] = [
      {
        filePath: '/src/shared.ts',
        sessionId: 's1',
        nodeId: 'conv-1',
        accentColor: '#FF6B35',
        lastTouchedAt: 1000
      },
      {
        filePath: '/src/shared.ts',
        sessionId: 's2',
        nodeId: 'conv-2',
        accentColor: '#4ECDC4',
        lastTouchedAt: 2000
      },
      {
        filePath: '/src/shared.ts',
        sessionId: 's3',
        nodeId: 'conv-3',
        accentColor: '#95E1D3',
        lastTouchedAt: 3000
      }
    ]
    const conflicts = detectFileConflicts(records)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].sessions).toHaveLength(3)
  })

  it('returns empty for empty records', () => {
    expect(detectFileConflicts([])).toHaveLength(0)
  })

  it('returns multiple conflicts for multiple contested files', () => {
    const records: FileTouchRecord[] = [
      {
        filePath: '/src/a.ts',
        sessionId: 's1',
        nodeId: 'conv-1',
        accentColor: '#FF6B35',
        lastTouchedAt: 1000
      },
      {
        filePath: '/src/a.ts',
        sessionId: 's2',
        nodeId: 'conv-2',
        accentColor: '#4ECDC4',
        lastTouchedAt: 2000
      },
      {
        filePath: '/src/b.ts',
        sessionId: 's1',
        nodeId: 'conv-1',
        accentColor: '#FF6B35',
        lastTouchedAt: 3000
      },
      {
        filePath: '/src/b.ts',
        sessionId: 's3',
        nodeId: 'conv-3',
        accentColor: '#95E1D3',
        lastTouchedAt: 4000
      }
    ]
    const conflicts = detectFileConflicts(records)
    expect(conflicts).toHaveLength(2)
  })
})

describe('getFileTouchEdgeStyle', () => {
  it('returns dashed line style with correct color', () => {
    const style = getFileTouchEdgeStyle('#FF6B35')
    expect(style.stroke).toBe('#FF6B35')
    expect(style.strokeDasharray).toBe('5,5')
    expect(style.strokeWidth).toBe(2)
    expect(style.opacity).toBe(0.7)
    expect(style.fill).toBe('none')
  })

  it('uses the provided accent color', () => {
    const style = getFileTouchEdgeStyle('#4ECDC4')
    expect(style.stroke).toBe('#4ECDC4')
  })
})

describe('isFileTouchEdge', () => {
  it('returns true for valid file touch edge data', () => {
    expect(
      isFileTouchEdge({
        isFileTouchEdge: true,
        sessionAccentColor: '#FF6B35',
        visible: true,
        filePath: '/a.ts',
        sessionId: 's1'
      })
    ).toBe(true)
  })

  it('returns false for null', () => {
    expect(isFileTouchEdge(null)).toBe(false)
  })

  it('returns false for regular edge data', () => {
    expect(isFileTouchEdge({ contextRole: 'primary' })).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isFileTouchEdge(undefined)).toBe(false)
  })

  it('returns false for non-object', () => {
    expect(isFileTouchEdge('string')).toBe(false)
  })

  it('returns false for number', () => {
    expect(isFileTouchEdge(42)).toBe(false)
  })

  it('returns false when isFileTouchEdge is false', () => {
    expect(
      isFileTouchEdge({
        isFileTouchEdge: false,
        sessionAccentColor: '#FF6B35',
        visible: true,
        filePath: '/a.ts',
        sessionId: 's1'
      })
    ).toBe(false)
  })
})
