// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import {
  ContextBudgetManager,
  AGGREGATE_TOKEN_CAP,
  MAX_CONTEXT_RETRIES,
  recordContextError,
  clearContextErrorState,
  getContextErrorState,
  _resetErrorRetryStates,
} from '../contextBudget'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTempWorkspace(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cg-budget-test-'))
}

function removeTempWorkspace(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true })
  } catch {
    // Best-effort cleanup
  }
}

// ---------------------------------------------------------------------------
// ContextBudgetManager
// ---------------------------------------------------------------------------

describe('ContextBudgetManager', () => {
  let manager: ContextBudgetManager
  let tempDir: string

  beforeEach(() => {
    manager = new ContextBudgetManager()
    tempDir = createTempWorkspace()
    manager.setWorkspacePath(tempDir)
  })

  afterEach(() => {
    manager.reset()
    removeTempWorkspace(tempDir)
  })

  // -------------------------------------------------------------------------
  // Basic tracking
  // -------------------------------------------------------------------------

  describe('conversation tracking', () => {
    it('tracks a new conversation', () => {
      manager.trackConversation('conv-1', 5000)
      expect(manager.getAggregateTokens()).toBe(5000)
    })

    it('updates token count for existing conversation', () => {
      manager.trackConversation('conv-1', 5000)
      manager.trackConversation('conv-1', 8000)
      expect(manager.getAggregateTokens()).toBe(8000)
    })

    it('tracks multiple conversations', () => {
      manager.trackConversation('conv-1', 5000)
      manager.trackConversation('conv-2', 10000)
      manager.trackConversation('conv-3', 15000)
      expect(manager.getAggregateTokens()).toBe(30000)
    })

    it('untracks a conversation', () => {
      manager.trackConversation('conv-1', 5000)
      manager.trackConversation('conv-2', 10000)
      manager.untrackConversation('conv-1')
      expect(manager.getAggregateTokens()).toBe(10000)
    })
  })

  // -------------------------------------------------------------------------
  // Spill works at 200K cap
  // -------------------------------------------------------------------------

  describe('spill at 200K cap', () => {
    it('freezes oldest conversations when approaching 200K aggregate cap', () => {
      // Fill up to near the cap
      manager.trackConversation('old-1', 80_000)
      // Advance time
      manager.trackConversation('old-2', 80_000)
      manager.trackConversation('current', 30_000)

      // Check budget for adding more — should trigger freeze
      const result = manager.checkBudget('current', 20_000)

      // Should freeze old conversations to make room
      expect(result.frozenCount).toBeGreaterThan(0)
    })

    it('allows operation when under budget', () => {
      manager.trackConversation('conv-1', 50_000)
      const result = manager.checkBudget('conv-1', 10_000)
      expect(result.allowed).toBe(true)
      expect(result.frozenCount).toBe(0)
    })

    it('rejects when even after freezing cannot fit', () => {
      // Single conversation at the cap
      manager.trackConversation('only', AGGREGATE_TOKEN_CAP)
      const result = manager.checkBudget('only', 50_000)
      expect(result.allowed).toBe(false)
      expect(result.reason).toBeDefined()
    })

    it('spills conversation content to disk', () => {
      manager.trackConversation('conv-1', 100_000)

      const content = 'A'.repeat(5000)
      const result = manager.spillToDisk('conv-1', content)

      expect(result.spillPath).toBeTruthy()
      expect(result.verified).toBe(true)
      expect(result.preview.length).toBeLessThanOrEqual(2048) // 2KB

      // File should exist on disk
      expect(fs.existsSync(result.spillPath)).toBe(true)

      // File content should match
      const diskContent = fs.readFileSync(result.spillPath, 'utf-8')
      expect(diskContent).toBe(content)
    })

    it('retains 2KB preview in memory after spill', () => {
      manager.trackConversation('conv-1', 100_000)

      const content = 'B'.repeat(5000)
      const result = manager.spillToDisk('conv-1', content)

      // Preview should be first 2KB
      expect(result.preview).toBe(content.slice(0, 2048))

      // Entry should have the preview
      const entry = manager.getEntry('conv-1')
      expect(entry?.spillPreview).toBe(content.slice(0, 2048))
    })

    it('reduces tracked token count after spill', () => {
      manager.trackConversation('conv-1', 100_000)
      const before = manager.getAggregateTokens()
      expect(before).toBe(100_000)

      manager.spillToDisk('conv-1', 'Small preview content')
      const after = manager.getAggregateTokens()

      // After spill, token count should reflect only the preview
      expect(after).toBeLessThan(before)
    })

    it('throws when no workspace path configured', () => {
      const noWorkspaceManager = new ContextBudgetManager()
      noWorkspaceManager.trackConversation('conv-1', 50_000)

      expect(() => noWorkspaceManager.spillToDisk('conv-1', 'content')).toThrow(
        /no workspace path/i,
      )
    })
  })

  // -------------------------------------------------------------------------
  // Verify-before-return catches deleted temp file
  // -------------------------------------------------------------------------

  describe('verify-before-return', () => {
    it('returns valid when spill file exists', () => {
      manager.trackConversation('conv-1', 50_000)
      manager.spillToDisk('conv-1', 'test content')

      const verification = manager.verifySpillFile('conv-1')
      expect(verification.valid).toBe(true)
      expect(verification.path).toBeTruthy()
      expect(verification.preview).toBeDefined()
    })

    it('detects deleted spill file and surfaces loss', () => {
      manager.trackConversation('conv-1', 50_000)
      const spillResult = manager.spillToDisk('conv-1', 'test content')

      // Delete the file externally
      fs.unlinkSync(spillResult.spillPath)

      const verification = manager.verifySpillFile('conv-1')
      expect(verification.valid).toBe(false)
      expect(verification.lostMessage).toContain('LOST')
      expect(verification.lostMessage).toContain('conv-1')
      // Preview should still survive
      expect(verification.preview).toBe('test content')
    })

    it('returns invalid for conversation without spill', () => {
      manager.trackConversation('conv-1', 50_000)

      const verification = manager.verifySpillFile('conv-1')
      expect(verification.valid).toBe(false)
      expect(verification.path).toBeUndefined()
    })

    it('returns invalid for unknown conversation', () => {
      const verification = manager.verifySpillFile('nonexistent')
      expect(verification.valid).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // Spill file verified before path returned
  // -------------------------------------------------------------------------

  describe('spill file existence verification', () => {
    it('spill file exists on disk before spillToDisk returns', () => {
      manager.trackConversation('conv-1', 100_000)

      const content = 'Verification test content — ' + 'Z'.repeat(3000)
      const result = manager.spillToDisk('conv-1', content)

      // The returned result must include verified=true, meaning the file
      // was confirmed to exist on disk BEFORE the method returned
      expect(result.verified).toBe(true)
      expect(result.spillPath).toBeTruthy()

      // Double-check: file actually exists at the returned path
      expect(fs.existsSync(result.spillPath)).toBe(true)

      // And the content matches what was written
      const diskContent = fs.readFileSync(result.spillPath, 'utf-8')
      expect(diskContent).toBe(content)
    })

    it('entry spillPath is set before spillToDisk returns', () => {
      manager.trackConversation('conv-1', 100_000)

      const result = manager.spillToDisk('conv-1', 'entry check')

      // The entry should have the spill path set
      const entry = manager.getEntry('conv-1')
      expect(entry?.spillPath).toBe(result.spillPath)
      // And the path should point to an existing file
      expect(fs.existsSync(entry!.spillPath!)).toBe(true)
    })

    it('deleted spill file error is surfaced, not silently ignored', () => {
      manager.trackConversation('conv-1', 100_000)
      const spillResult = manager.spillToDisk('conv-1', 'critical data')

      // Simulate external deletion between creation and access
      fs.unlinkSync(spillResult.spillPath)

      // verifySpillFile must detect the loss and surface it explicitly
      const verification = manager.verifySpillFile('conv-1')

      // Must NOT be valid
      expect(verification.valid).toBe(false)

      // Must include an explicit loss message (not silently return undefined)
      expect(verification.lostMessage).toBeDefined()
      expect(verification.lostMessage).toContain('LOST')
      expect(verification.lostMessage).toContain(spillResult.spillPath)

      // The path should still be available (for diagnostics)
      expect(verification.path).toBe(spillResult.spillPath)

      // The 2KB preview should survive the file loss
      expect(verification.preview).toBe('critical data')
    })

    it('successive verifications after deletion consistently report loss', () => {
      manager.trackConversation('conv-1', 100_000)
      const spillResult = manager.spillToDisk('conv-1', 'repeated check')
      fs.unlinkSync(spillResult.spillPath)

      // First verification
      const v1 = manager.verifySpillFile('conv-1')
      expect(v1.valid).toBe(false)
      expect(v1.lostMessage).toBeDefined()

      // Second verification — should still report loss, not swallow it
      const v2 = manager.verifySpillFile('conv-1')
      expect(v2.valid).toBe(false)
      expect(v2.lostMessage).toBeDefined()
    })
  })

  // -------------------------------------------------------------------------
  // Cleanup on workspace close prunes temp files
  // -------------------------------------------------------------------------

  describe('cleanup on workspace close', () => {
    it('prunes all context-spill files from temp directory', () => {
      manager.trackConversation('conv-1', 50_000)
      manager.trackConversation('conv-2', 50_000)

      manager.spillToDisk('conv-1', 'content 1')
      manager.spillToDisk('conv-2', 'content 2')

      const spillDir = path.join(tempDir, '.cognograph', 'temp')
      const filesBefore = fs.readdirSync(spillDir).filter((f) =>
        f.startsWith('context-spill-'),
      )
      expect(filesBefore.length).toBe(2)

      manager.pruneSpillFiles()

      const filesAfter = fs.readdirSync(spillDir).filter((f) =>
        f.startsWith('context-spill-'),
      )
      expect(filesAfter.length).toBe(0)
    })

    it('does not prune non-spill files', () => {
      const spillDir = path.join(tempDir, '.cognograph', 'temp')
      fs.mkdirSync(spillDir, { recursive: true })

      // Create a non-spill file
      fs.writeFileSync(path.join(spillDir, 'tool-result-abc-123.txt'), 'data')

      // Create a spill file
      manager.trackConversation('conv-1', 50_000)
      manager.spillToDisk('conv-1', 'content')

      manager.pruneSpillFiles()

      const files = fs.readdirSync(spillDir)
      expect(files).toContain('tool-result-abc-123.txt')
      expect(files.filter((f) => f.startsWith('context-spill-')).length).toBe(0)
    })

    it('clears all entries on prune', () => {
      manager.trackConversation('conv-1', 50_000)
      manager.trackConversation('conv-2', 50_000)

      manager.pruneSpillFiles()

      expect(manager.getAggregateTokens()).toBe(0)
      expect(manager.getEntries().size).toBe(0)
    })

    it('handles missing temp directory gracefully', () => {
      const noTempManager = new ContextBudgetManager()
      noTempManager.setWorkspacePath('/nonexistent/path')
      // Should not throw
      expect(() => noTempManager.pruneSpillFiles()).not.toThrow()
    })
  })

  // -------------------------------------------------------------------------
  // Frozen conversation detection
  // -------------------------------------------------------------------------

  describe('frozen conversations', () => {
    it('reports unfrozen for new conversations', () => {
      manager.trackConversation('conv-1', 50_000)
      expect(manager.isFrozen('conv-1')).toBe(false)
    })

    it('never freezes the requesting conversation', () => {
      // Even at capacity, the requesting conversation stays unfrozen
      manager.trackConversation('conv-1', AGGREGATE_TOKEN_CAP)
      manager.checkBudget('conv-1', 10_000)
      expect(manager.isFrozen('conv-1')).toBe(false)
    })
  })
})

// ---------------------------------------------------------------------------
// Error withholding / recovery (3.2g)
// ---------------------------------------------------------------------------

describe('413 error withholding and recovery', () => {
  beforeEach(() => {
    _resetErrorRetryStates()
  })

  it('withholds errors for first retry', () => {
    const result = recordContextError('conv-1', 'Context too large')
    expect(result.shouldSurface).toBe(false)
    expect(result.retryCount).toBe(1)
  })

  it('withholds errors for second retry', () => {
    recordContextError('conv-1', 'Context too large')
    const result = recordContextError('conv-1', 'Context too large')
    expect(result.shouldSurface).toBe(false)
    expect(result.retryCount).toBe(2)
  })

  it('surfaces error after MAX_CONTEXT_RETRIES', () => {
    for (let i = 0; i < MAX_CONTEXT_RETRIES - 1; i++) {
      const interim = recordContextError('conv-1', 'Context too large')
      expect(interim.shouldSurface).toBe(false)
    }

    const final = recordContextError('conv-1', 'Context too large')
    expect(final.shouldSurface).toBe(true)
    expect(final.retryCount).toBe(MAX_CONTEXT_RETRIES)
  })

  it('marks compaction as attempted', () => {
    const result = recordContextError('conv-1', 'Context too large')
    expect(result.state.compactionAttempted).toBe(true)
  })

  it('clears error state on success', () => {
    recordContextError('conv-1', 'Context too large')
    expect(getContextErrorState('conv-1')).toBeDefined()

    clearContextErrorState('conv-1')
    expect(getContextErrorState('conv-1')).toBeUndefined()
  })

  it('tracks separate state per conversation', () => {
    recordContextError('conv-1', 'Error 1')
    recordContextError('conv-2', 'Error 2')

    expect(getContextErrorState('conv-1')?.retryCount).toBe(1)
    expect(getContextErrorState('conv-2')?.retryCount).toBe(1)
  })

  it('increments retry count across multiple errors', () => {
    recordContextError('conv-1', 'Error 1')
    recordContextError('conv-1', 'Error 2')
    recordContextError('conv-1', 'Error 3')

    const state = getContextErrorState('conv-1')
    expect(state?.retryCount).toBe(3)
    expect(state?.lastError).toBe('Error 3')
  })
})
