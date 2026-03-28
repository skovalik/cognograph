// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'path'

// ---------------------------------------------------------------------------
// Mock electron before importing the module under test
// ---------------------------------------------------------------------------

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/userData'),
    getAppPath: vi.fn(() => '/mock/appPath'),
    isPackaged: false,
  },
}))

// ---------------------------------------------------------------------------
// Mock contextWriter's getWorkspaceFilePath + getAppPath
// ---------------------------------------------------------------------------

const mockGetWorkspaceFilePath = vi.fn().mockResolvedValue('/mock/userData/workspaces/ws-123.json')
const mockGetAppPath = vi.fn(() => '/mock/userData')

vi.mock('../contextWriter', () => ({
  getWorkspaceFilePath: (...args: unknown[]) => mockGetWorkspaceFilePath(...args),
  getAppPath: (...args: unknown[]) => mockGetAppPath(...args),
}))

// ---------------------------------------------------------------------------
// Mock fs — must be a complete mock (no importOriginal in jsdom env)
// ---------------------------------------------------------------------------

const mockReadFile = vi.fn().mockRejectedValue(new Error('ENOENT'))
const mockWriteFile = vi.fn().mockResolvedValue(undefined)
const mockUnlink = vi.fn().mockResolvedValue(undefined)
const mockAccess = vi.fn().mockRejectedValue(new Error('ENOENT'))

vi.mock('fs', () => ({
  default: {
    promises: {
      readFile: (...args: unknown[]) => mockReadFile(...args),
      writeFile: (...args: unknown[]) => mockWriteFile(...args),
      unlink: (...args: unknown[]) => mockUnlink(...args),
      access: (...args: unknown[]) => mockAccess(...args),
    },
  },
  promises: {
    readFile: (...args: unknown[]) => mockReadFile(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
    unlink: (...args: unknown[]) => mockUnlink(...args),
    access: (...args: unknown[]) => mockAccess(...args),
  },
}))

// Import after mocking
import { writeClaudeConfig, cleanupClaudeConfig, recoverClaudeMd } from '../claudeConfigWriter'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SECTION_START = '<!-- COGNOGRAPH-CONTEXT-START -->'
const SECTION_END = '<!-- COGNOGRAPH-CONTEXT-END -->'
const BACKUP_NAME = '.cognograph-claude-backup'

/** Simulate fs.readFile returning different content per file path */
function mockFileSystem(files: Record<string, string>) {
  mockReadFile.mockImplementation(async (path: unknown) => {
    const p = String(path)
    for (const [key, value] of Object.entries(files)) {
      if (p.endsWith(key)) return value
    }
    throw new Error('ENOENT')
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('claudeConfigWriter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReadFile.mockRejectedValue(new Error('ENOENT'))
    mockWriteFile.mockResolvedValue(undefined)
    mockUnlink.mockResolvedValue(undefined)
    mockAccess.mockRejectedValue(new Error('ENOENT'))
    mockGetWorkspaceFilePath.mockResolvedValue('/mock/userData/workspaces/ws-123.json')
  })

  describe('writeClaudeConfig — no existing CLAUDE.md', () => {
    it('writes .mcp.json and CLAUDE.md on success', async () => {
      const result = await writeClaudeConfig({
        nodeId: 'node-abc-123',
        cwd: '/test/project',
        nodeTitle: 'My Terminal',
        contextMarkdown: '## Connected Nodes\n\nSome context here',
      })

      expect(result.success).toBe(true)
      expect(result.appendedToExisting).toBe(false)
      expect(result.mcpConfigPath).toBe(join('/test/project', '.mcp.json'))
      expect(result.claudeMdPath).toBe(join('/test/project', 'CLAUDE.md'))

      // Verify .mcp.json was written
      const mcpCall = mockWriteFile.mock.calls.find(
        (call: unknown[]) => String(call[0]).endsWith('.mcp.json'),
      )
      expect(mcpCall).toBeDefined()
      expect(mcpCall![1]).toContain('"cognograph"')

      // Verify CLAUDE.md was written with markers
      const claudeCall = mockWriteFile.mock.calls.find(
        (call: unknown[]) => String(call[0]).endsWith('CLAUDE.md'),
      )
      expect(claudeCall).toBeDefined()
      const content = claudeCall![1] as string
      expect(content).toContain(SECTION_START)
      expect(content).toContain(SECTION_END)
      expect(content).toContain('Cognograph Workspace Context')
    })

    it('includes node ID and title in CLAUDE.md', async () => {
      await writeClaudeConfig({
        nodeId: 'node-xyz',
        cwd: '/test/project',
        nodeTitle: 'Research Hub',
      })

      const claudeCall = mockWriteFile.mock.calls.find(
        (call: unknown[]) => String(call[0]).endsWith('CLAUDE.md'),
      )
      expect(claudeCall).toBeDefined()
      const content = claudeCall![1] as string
      expect(content).toContain('node-xyz')
      expect(content).toContain('Research Hub')
    })
  })

  describe('writeClaudeConfig — existing user CLAUDE.md', () => {
    it('appends Cognograph section to user CLAUDE.md', async () => {
      const userContent = '# My Project\n\nThis is my own CLAUDE.md with important instructions.'

      // First read (recovery check) → existing user file without markers
      // Second read (recovery marker check) → same
      // Third read (main logic) → same
      mockReadFile.mockImplementation(async (path: unknown) => {
        const p = String(path)
        if (p.endsWith('CLAUDE.md')) return userContent
        throw new Error('ENOENT')
      })

      const result = await writeClaudeConfig({
        nodeId: 'node-append',
        cwd: '/test/project',
      })

      expect(result.success).toBe(true)
      expect(result.appendedToExisting).toBe(true)
      expect(result.backupPath).toBe(join('/test/project', BACKUP_NAME))

      // Should have written backup
      const backupCall = mockWriteFile.mock.calls.find(
        (call: unknown[]) => String(call[0]).endsWith(BACKUP_NAME),
      )
      expect(backupCall).toBeDefined()
      expect(backupCall![1]).toBe(userContent)

      // Should have written CLAUDE.md with user content + appended section
      const claudeCall = mockWriteFile.mock.calls.find(
        (call: unknown[]) => String(call[0]).endsWith('CLAUDE.md'),
      )
      expect(claudeCall).toBeDefined()
      const written = claudeCall![1] as string
      expect(written).toContain(userContent)
      expect(written).toContain(SECTION_START)
      expect(written).toContain(SECTION_END)
      expect(written).toContain('Cognograph Workspace Context')
    })

    it('replaces existing Cognograph section on re-spawn', async () => {
      const originalUser = '# My Project\nMy instructions.'
      const existingWithMarkers = originalUser + '\n\n' + SECTION_START + '\nOLD CONTENT\n' + SECTION_END

      mockReadFile.mockImplementation(async (path: unknown) => {
        const p = String(path)
        if (p.endsWith('CLAUDE.md')) return existingWithMarkers
        throw new Error('ENOENT')
      })
      // For the backup existence check in re-spawn path
      mockAccess.mockResolvedValue(undefined)

      const result = await writeClaudeConfig({
        nodeId: 'node-respawn',
        cwd: '/test/project',
      })

      expect(result.success).toBe(true)
      expect(result.appendedToExisting).toBe(true)

      // Verify CLAUDE.md was written with NEW cognograph section
      const claudeCall = mockWriteFile.mock.calls.find(
        (call: unknown[]) => String(call[0]).endsWith('CLAUDE.md'),
      )
      expect(claudeCall).toBeDefined()
      const written = claudeCall![1] as string
      expect(written).toContain(originalUser)
      expect(written).toContain('node-respawn')
      expect(written).not.toContain('OLD CONTENT')
    })
  })

  describe('writeClaudeConfig — error handling', () => {
    it('returns failure when no workspace is active', async () => {
      mockGetWorkspaceFilePath.mockResolvedValueOnce(null)

      const result = await writeClaudeConfig({
        nodeId: 'node-test',
        cwd: '/test/project',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('No active workspace')
      expect(result.appendedToExisting).toBe(false)
    })
  })

  describe('writeClaudeConfig — .mcp.json merge', () => {
    it('merges with existing .mcp.json if present', async () => {
      mockFileSystem({
        '.mcp.json': JSON.stringify({
          mcpServers: { 'other-server': { command: 'other', args: [] } },
        }),
      })

      await writeClaudeConfig({
        nodeId: 'node-merge',
        cwd: '/test/project',
      })

      const mcpCall = mockWriteFile.mock.calls.find(
        (call: unknown[]) => String(call[0]).endsWith('.mcp.json'),
      )
      const config = JSON.parse(mcpCall![1] as string)
      expect(config.mcpServers['other-server']).toBeDefined()
      expect(config.mcpServers.cognograph).toBeDefined()
    })
  })

  describe('cleanupClaudeConfig', () => {
    it('strips appended section from user CLAUDE.md', async () => {
      const userContent = '# My Project\n\nMy instructions.'
      const fullContent = userContent + '\n\n' + SECTION_START + '\n# Cognograph...\n' + SECTION_END

      mockFileSystem({
        '.mcp.json': JSON.stringify({ mcpServers: { cognograph: {} } }),
        'CLAUDE.md': fullContent,
      })

      await cleanupClaudeConfig('/test/project')

      // CLAUDE.md should be written back with user content only
      const claudeCall = mockWriteFile.mock.calls.find(
        (call: unknown[]) => String(call[0]).endsWith('CLAUDE.md'),
      )
      expect(claudeCall).toBeDefined()
      const restored = claudeCall![1] as string
      expect(restored).toContain('My Project')
      expect(restored).not.toContain(SECTION_START)
      expect(restored).not.toContain('Cognograph')
    })

    it('deletes CLAUDE.md when it was entirely Cognograph content', async () => {
      const cogOnly = SECTION_START + '\n# Cognograph Workspace Context\n' + SECTION_END

      mockFileSystem({
        '.mcp.json': JSON.stringify({ mcpServers: { cognograph: {} } }),
        'CLAUDE.md': cogOnly,
      })

      await cleanupClaudeConfig('/test/project')

      expect(mockUnlink).toHaveBeenCalledWith(join('/test/project', 'CLAUDE.md'))
    })

    it('deletes legacy Cognograph-only CLAUDE.md (no markers)', async () => {
      mockFileSystem({
        '.mcp.json': JSON.stringify({ mcpServers: { cognograph: {} } }),
        'CLAUDE.md': '# Cognograph Workspace Context\n\nOld format without markers',
      })

      await cleanupClaudeConfig('/test/project')

      expect(mockUnlink).toHaveBeenCalledWith(join('/test/project', 'CLAUDE.md'))
    })

    it('does not modify user CLAUDE.md without markers', async () => {
      mockFileSystem({
        'CLAUDE.md': '# My Project\n\nNo Cognograph here.',
      })

      await cleanupClaudeConfig('/test/project')

      // Should not write or delete CLAUDE.md
      const claudeWrites = mockWriteFile.mock.calls.filter(
        (call: unknown[]) => String(call[0]).endsWith('CLAUDE.md'),
      )
      expect(claudeWrites).toHaveLength(0)
      expect(mockUnlink).not.toHaveBeenCalledWith(join('/test/project', 'CLAUDE.md'))
    })

    it('removes .mcp.json when only cognograph server exists', async () => {
      mockFileSystem({
        '.mcp.json': JSON.stringify({ mcpServers: { cognograph: {} } }),
      })

      await cleanupClaudeConfig('/test/project')

      expect(mockUnlink).toHaveBeenCalledWith(join('/test/project', '.mcp.json'))
    })

    it('preserves .mcp.json when other servers exist', async () => {
      mockFileSystem({
        '.mcp.json': JSON.stringify({
          mcpServers: { cognograph: {}, 'other-server': { command: 'other' } },
        }),
      })

      await cleanupClaudeConfig('/test/project')

      const mcpCall = mockWriteFile.mock.calls.find(
        (call: unknown[]) => String(call[0]).endsWith('.mcp.json'),
      )
      expect(mcpCall).toBeDefined()
      expect(mcpCall![1]).not.toContain('cognograph')
    })

    it('cleans up backup file', async () => {
      mockFileSystem({
        '.mcp.json': JSON.stringify({ mcpServers: { cognograph: {} } }),
        'CLAUDE.md': SECTION_START + '\nContent\n' + SECTION_END,
      })
      // Backup exists
      mockUnlink.mockResolvedValue(undefined)

      await cleanupClaudeConfig('/test/project')

      expect(mockUnlink).toHaveBeenCalledWith(join('/test/project', BACKUP_NAME))
    })

    it('handles missing files gracefully', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'))

      await expect(cleanupClaudeConfig('/test/project')).resolves.not.toThrow()
    })
  })

  describe('recoverClaudeMd', () => {
    it('restores from backup when backup exists', async () => {
      const originalContent = '# My Project\n\nOriginal content.'

      mockFileSystem({
        [BACKUP_NAME]: originalContent,
      })

      await recoverClaudeMd('/test/project')

      // Should write original content to CLAUDE.md
      expect(mockWriteFile).toHaveBeenCalledWith(
        join('/test/project', 'CLAUDE.md'),
        originalContent,
        'utf-8',
      )
      // Should delete backup
      expect(mockUnlink).toHaveBeenCalledWith(join('/test/project', BACKUP_NAME))
    })

    it('does NOT strip markers when no backup exists (another terminal may be active)', async () => {
      const contentWithMarkers = '# My Project\n\nInstructions.' +
        '\n\n' + SECTION_START + '\nActive Cognograph section\n' + SECTION_END

      mockFileSystem({
        'CLAUDE.md': contentWithMarkers,
      })

      await recoverClaudeMd('/test/project')

      // Should NOT modify CLAUDE.md — markers without backup could mean active terminal
      expect(mockWriteFile).not.toHaveBeenCalled()
      expect(mockUnlink).not.toHaveBeenCalled()
    })

    it('no-ops when no backup and no markers', async () => {
      mockFileSystem({
        'CLAUDE.md': '# My Clean Project\n\nNo markers here.',
      })

      await recoverClaudeMd('/test/project')

      expect(mockWriteFile).not.toHaveBeenCalled()
      expect(mockUnlink).not.toHaveBeenCalled()
    })

    it('no-ops when no files exist', async () => {
      await recoverClaudeMd('/test/project')

      expect(mockWriteFile).not.toHaveBeenCalled()
      expect(mockUnlink).not.toHaveBeenCalled()
    })
  })
})
