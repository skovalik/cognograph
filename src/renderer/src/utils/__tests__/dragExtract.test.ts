import { describe, it, expect } from 'vitest'
import { createExtractionWithProvenance } from '../dragExtract'

describe('dragExtract', () => {
  describe('createExtractionWithProvenance', () => {
    it('returns correct NoteNode data', () => {
      const result = createExtractionWithProvenance(
        'source-node-1',
        'This is extracted content from the source node.',
        { x: 200, y: 300 }
      )

      expect(result.node.type).toBe('note')
      expect(result.node.position).toEqual({ x: 200, y: 300 })
      expect(result.node.data.type).toBe('note')
      expect(result.node.data.content).toBe('This is extracted content from the source node.')
      expect(result.node.data.title).toBe('This is extracted content from the source node.')
      expect(result.node.data.createdAt).toBeGreaterThan(0)
      expect(result.node.data.updatedAt).toBeGreaterThan(0)
      expect(result.node.data.contextMetadata.contextRole).toBe('reference')
      expect(result.node.data.contextMetadata.contextPriority).toBe('medium')
      expect(result.node.id).toBeTruthy()
    })

    it('returns provenance edge with correct contextRole and sourceRef', () => {
      const result = createExtractionWithProvenance(
        'src-42',
        'Some excerpt text',
        { x: 100, y: 100 }
      )

      expect(result.edge.source).toBe('src-42')
      expect(result.edge.target).toBe(result.node.id)
      expect(result.edge.data.contextRole).toBe('excerpt')
      expect(result.edge.data.sourceRef.nodeId).toBe('src-42')
      expect(result.edge.data.sourceRef.timestamp).toBeGreaterThan(0)
      expect(result.edge.data.label).toBe('excerpt')
      expect(result.edge.id).toBeTruthy()
    })

    it('generates unique IDs for node and edge', () => {
      const result1 = createExtractionWithProvenance('a', 'text1', { x: 0, y: 0 })
      const result2 = createExtractionWithProvenance('a', 'text2', { x: 0, y: 0 })

      expect(result1.node.id).not.toBe(result2.node.id)
      expect(result1.edge.id).not.toBe(result2.edge.id)
    })

    it('derives title from first line of content', () => {
      const multiline = createExtractionWithProvenance(
        'src',
        'First line title\nSecond line body\nThird line',
        { x: 0, y: 0 }
      )
      expect(multiline.node.data.title).toBe('First line title')
    })

    it('truncates long titles to 60 characters', () => {
      const longContent = 'A'.repeat(80) + '\nBody text'
      const result = createExtractionWithProvenance('src', longContent, { x: 0, y: 0 })
      expect(result.node.data.title.length).toBeLessThanOrEqual(60)
      expect(result.node.data.title).toMatch(/\.{3}$/)
    })

    it('uses fallback title for empty content', () => {
      const result = createExtractionWithProvenance('src', '', { x: 0, y: 0 })
      expect(result.node.data.title).toBe('Extracted note')
    })

    it('includes contextLabel referencing source node', () => {
      const result = createExtractionWithProvenance('my-source', 'text', { x: 0, y: 0 })
      expect(result.node.data.contextMetadata.contextLabel).toContain('my-source')
    })
  })
})
