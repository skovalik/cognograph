// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Filesystem Security Tests — Phase 0 (0.1a, 0.1b, 0.1c, 0.1h, 0.1l)
 *
 * Tests for:
 * 1. Symlink attack: symlink pointing outside allowed paths → blocked
 * 2. Symlink to trusted MCP root → allowed
 * 3. Empty allowlist → rejects (fail-closed)
 * 4. ReDoS pattern rejection
 * 5. Protected path write (.cognograph/, .env, .mcp.json) → requires approval
 * 6. Normal file within allowed paths → allowed (regression check)
 */

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  editFile,
  isProtectedPath,
  isRegexSafe,
  readFile,
  searchFiles,
  validateCommand,
  validatePath,
  writeFile,
} from '../../main/agent/filesystemTools'

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

let testDir: string
let allowedDir: string
let outsideDir: string
let trustedMcpDir: string

beforeEach(() => {
  // Create isolated temp directories for each test
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-sec-test-'))
  allowedDir = path.join(testDir, 'allowed')
  outsideDir = path.join(testDir, 'outside')
  trustedMcpDir = path.join(testDir, 'mcp-root')

  fs.mkdirSync(allowedDir, { recursive: true })
  fs.mkdirSync(outsideDir, { recursive: true })
  fs.mkdirSync(trustedMcpDir, { recursive: true })
})

afterEach(() => {
  // Cleanup temp directories
  try {
    fs.rmSync(testDir, { recursive: true, force: true })
  } catch {
    // Best-effort cleanup
  }
})

// ---------------------------------------------------------------------------
// 1. Symlink Attack — symlink pointing outside allowed paths is BLOCKED (0.1a)
// ---------------------------------------------------------------------------

describe('Symlink Security (0.1a)', () => {
  it('should block symlinks pointing outside allowed paths', () => {
    // Create a file outside allowed paths
    const secretFile = path.join(outsideDir, 'secret.txt')
    fs.writeFileSync(secretFile, 'SECRET_DATA')

    // Create a symlink inside allowed paths pointing to the secret file
    const symlinkPath = path.join(allowedDir, 'sneaky-link')
    try {
      fs.symlinkSync(secretFile, symlinkPath)
    } catch {
      // Symlink creation may fail without admin on Windows — skip gracefully
      console.warn(
        'Skipping symlink test — symlink creation requires elevated privileges on this platform',
      )
      return
    }

    const result = validatePath(symlinkPath, [allowedDir])
    expect(result.valid).toBe(false)
    expect(result.error).toContain('outside allowed directories')
  })

  it('should block directory symlinks pointing outside allowed paths', () => {
    // Create a directory outside allowed paths with a file in it
    const secretDir = path.join(outsideDir, 'secret-dir')
    fs.mkdirSync(secretDir)
    fs.writeFileSync(path.join(secretDir, 'data.txt'), 'CLASSIFIED')

    // Create a symlink inside allowed paths pointing to the secret directory
    const symlinkPath = path.join(allowedDir, 'sneaky-dir-link')
    try {
      fs.symlinkSync(secretDir, symlinkPath, 'dir')
    } catch {
      console.warn(
        'Skipping directory symlink test — symlink creation requires elevated privileges on this platform',
      )
      return
    }

    const result = validatePath(symlinkPath, [allowedDir])
    expect(result.valid).toBe(false)
    expect(result.error).toContain('outside allowed directories')
  })

  it('should allow symlinks pointing within allowed paths', () => {
    // Create a file inside allowed paths
    const targetFile = path.join(allowedDir, 'real-file.txt')
    fs.writeFileSync(targetFile, 'ALLOWED_DATA')

    // Create a symlink inside allowed paths pointing to the file (also in allowed)
    const symlinkPath = path.join(allowedDir, 'safe-link')
    try {
      fs.symlinkSync(targetFile, symlinkPath)
    } catch {
      console.warn(
        'Skipping symlink test — symlink creation requires elevated privileges on this platform',
      )
      return
    }

    const result = validatePath(symlinkPath, [allowedDir])
    expect(result.valid).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 2. Symlink to Trusted MCP Root → ALLOWED (0.1a)
// ---------------------------------------------------------------------------

describe('Trusted Symlink Targets (0.1a)', () => {
  it('should allow symlinks pointing to trusted MCP roots', () => {
    // Create a file in the trusted MCP root
    const mcpFile = path.join(trustedMcpDir, 'workspace.json')
    fs.writeFileSync(mcpFile, '{"nodes":[]}')

    // Create a symlink inside allowed paths pointing to the MCP root file
    const symlinkPath = path.join(allowedDir, 'mcp-link')
    try {
      fs.symlinkSync(mcpFile, symlinkPath)
    } catch {
      console.warn(
        'Skipping trusted symlink test — symlink creation requires elevated privileges on this platform',
      )
      return
    }

    // With trustedSymlinkTargets, the symlink should be allowed
    const result = validatePath(symlinkPath, [allowedDir], [trustedMcpDir])
    expect(result.valid).toBe(true)
  })

  it('should block symlinks to untrusted targets even when trusted targets exist', () => {
    // Create a file completely outside both allowed and trusted paths
    const untrustedDir = path.join(testDir, 'untrusted')
    fs.mkdirSync(untrustedDir)
    const untrustedFile = path.join(untrustedDir, 'bad.txt')
    fs.writeFileSync(untrustedFile, 'UNTRUSTED')

    // Create a symlink inside allowed paths pointing to the untrusted file
    const symlinkPath = path.join(allowedDir, 'bad-link')
    try {
      fs.symlinkSync(untrustedFile, symlinkPath)
    } catch {
      console.warn(
        'Skipping untrusted symlink test — symlink creation requires elevated privileges on this platform',
      )
      return
    }

    // Even with trustedSymlinkTargets configured, this should be blocked
    const result = validatePath(symlinkPath, [allowedDir], [trustedMcpDir])
    expect(result.valid).toBe(false)
    expect(result.error).toContain('outside allowed directories and trusted targets')
  })
})

// ---------------------------------------------------------------------------
// 3. Empty Allowlist → REJECTS (fail-closed) (0.1c)
// ---------------------------------------------------------------------------

describe('Empty Allowlist — Fail Closed (0.1c)', () => {
  it('should reject commands when allowedCommands is empty', () => {
    const result = validateCommand('ls -la', [])
    expect(result.valid).toBe(false)
    expect(result.error).toContain('No commands allowed')
  })

  it('should reject ANY command with empty allowlist', () => {
    const result = validateCommand('cat /etc/passwd', [])
    expect(result.valid).toBe(false)
    expect(result.error).toContain('No commands allowed')
  })

  it('should allow commands in the allowlist', () => {
    const result = validateCommand('git status', ['git', 'npm'])
    expect(result.valid).toBe(true)
  })

  it('should reject commands not in the allowlist', () => {
    const result = validateCommand('rm -rf /', ['git', 'npm'])
    expect(result.valid).toBe(false)
    expect(result.error).toContain('not in allowed list')
  })

  it('should reject empty commands', () => {
    const result = validateCommand('', ['git'])
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Empty command')
  })
})

// ---------------------------------------------------------------------------
// 4. ReDoS Pattern Rejection (0.1h)
// ---------------------------------------------------------------------------

describe('ReDoS Pattern Detection (0.1h)', () => {
  it('should reject (a+)+$ — classic ReDoS', () => {
    const result = isRegexSafe('(a+)+$')
    expect(result.safe).toBe(false)
    expect(result.error).toContain('nested quantifiers')
  })

  it('should reject (a+)+ — nested quantifiers', () => {
    const result = isRegexSafe('(a+)+')
    expect(result.safe).toBe(false)
    expect(result.error).toContain('nested quantifiers')
  })

  it('should reject (a*)*  — nested star quantifiers', () => {
    const result = isRegexSafe('(a*)*')
    expect(result.safe).toBe(false)
    expect(result.error).toContain('nested quantifiers')
  })

  it('should reject (.*a)+ — dot-star in group with quantifier', () => {
    const result = isRegexSafe('(.*a)+')
    expect(result.safe).toBe(false)
    expect(result.error).toContain('nested quantifiers')
  })

  it('should reject patterns longer than 256 chars', () => {
    const longPattern = 'a'.repeat(300)
    const result = isRegexSafe(longPattern)
    expect(result.safe).toBe(false)
    expect(result.error).toContain('too long')
  })

  it('should reject invalid regex syntax', () => {
    const result = isRegexSafe('(unclosed')
    expect(result.safe).toBe(false)
    expect(result.error).toContain('Invalid regex')
  })

  it('should allow safe patterns', () => {
    expect(isRegexSafe('hello').safe).toBe(true)
    expect(isRegexSafe('\\bfunction\\b').safe).toBe(true)
    expect(isRegexSafe('import.*from').safe).toBe(true)
    expect(isRegexSafe('[a-z]+').safe).toBe(true)
    expect(isRegexSafe('\\d{3}-\\d{4}').safe).toBe(true)
  })

  it('should integrate with searchFiles and block ReDoS', () => {
    // Create a test file
    const testFile = path.join(allowedDir, 'test.txt')
    fs.writeFileSync(testFile, 'some content here')

    const result = searchFiles(allowedDir, '(a+)+$', [allowedDir])
    expect(result.success).toBe(false)
    expect(result.error).toContain('Unsafe search pattern')
  })
})

// ---------------------------------------------------------------------------
// 5. Protected Path Writes (.cognograph/, .env, .mcp.json) → REQUIRE APPROVAL (0.1l)
// ---------------------------------------------------------------------------

describe('Protected Paths (0.1l)', () => {
  it('should detect .cognograph/ as protected', () => {
    expect(isProtectedPath('/home/user/project/.cognograph/config.json')).toBe(
      '.cognograph/ directory',
    )
    expect(isProtectedPath('C:\\Users\\me\\project\\.cognograph\\settings.json')).toBe(
      '.cognograph/ directory',
    )
  })

  it('should detect .mcp.json as protected', () => {
    expect(isProtectedPath('/home/user/project/.mcp.json')).toBe('.mcp.json config')
    expect(isProtectedPath('C:\\Users\\me\\.mcp.json')).toBe('.mcp.json config')
  })

  it('should detect mcp.json as protected', () => {
    expect(isProtectedPath('/home/user/project/mcp.json')).toBe('mcp.json config')
  })

  it('should detect .env as protected', () => {
    expect(isProtectedPath('/project/.env')).toBe('.env file')
  })

  it('should detect .env.* as protected', () => {
    expect(isProtectedPath('/project/.env.local')).toBe('.env.* file')
    expect(isProtectedPath('/project/.env.production')).toBe('.env.* file')
  })

  it('should detect shell profiles as protected', () => {
    expect(isProtectedPath('/home/user/.bashrc')).toBe('.bashrc')
    expect(isProtectedPath('/home/user/.zshrc')).toBe('.zshrc')
    expect(isProtectedPath('/home/user/.profile')).toBe('.profile')
    expect(isProtectedPath('/home/user/.gitconfig')).toBe('.gitconfig')
  })

  it('should detect credential directories as protected', () => {
    expect(isProtectedPath('/home/user/.ssh/id_rsa')).toBe('.ssh/ directory')
    expect(isProtectedPath('/home/user/.gnupg/pubring.kbx')).toBe('.gnupg/ directory')
    expect(isProtectedPath('/home/user/.aws/credentials')).toBe('AWS credentials')
  })

  it('should detect .npmrc and .netrc as protected', () => {
    expect(isProtectedPath('/home/user/.npmrc')).toBe('.npmrc')
    expect(isProtectedPath('/home/user/.netrc')).toBe('.netrc')
  })

  it('should NOT flag normal files as protected', () => {
    expect(isProtectedPath('/project/src/index.ts')).toBeNull()
    expect(isProtectedPath('/project/package.json')).toBeNull()
    expect(isProtectedPath('/project/README.md')).toBeNull()
    expect(isProtectedPath('/project/src/env.ts')).toBeNull()
    expect(isProtectedPath('/project/.gitignore')).toBeNull()
  })

  it('should block writeFile to .cognograph/', () => {
    const cognoPath = path.join(allowedDir, '.cognograph', 'config.json')
    const result = writeFile(cognoPath, '{}', [allowedDir])
    expect(result.success).toBe(false)
    expect(result.error).toContain('Protected path')
    expect(result.error).toContain('.cognograph/ directory')
    expect(result.error).toContain('requires explicit approval')
  })

  it('should block writeFile to .env', () => {
    const envPath = path.join(allowedDir, '.env')
    const result = writeFile(envPath, 'SECRET=value', [allowedDir])
    expect(result.success).toBe(false)
    expect(result.error).toContain('Protected path')
    expect(result.error).toContain('.env file')
  })

  it('should block writeFile to .mcp.json', () => {
    const mcpPath = path.join(allowedDir, '.mcp.json')
    const result = writeFile(mcpPath, '{}', [allowedDir])
    expect(result.success).toBe(false)
    expect(result.error).toContain('Protected path')
    expect(result.error).toContain('.mcp.json config')
  })

  it('should block editFile to protected paths', () => {
    // Create the file first so editFile can find it
    const envPath = path.join(allowedDir, '.env')
    fs.writeFileSync(envPath, 'OLD=value')

    const result = editFile(envPath, 'OLD', 'NEW', [allowedDir])
    expect(result.success).toBe(false)
    expect(result.error).toContain('Protected path')
  })
})

// ---------------------------------------------------------------------------
// 6. Normal File Within Allowed Paths → ALLOWED (Regression Check)
// ---------------------------------------------------------------------------

describe('Normal Operations — Regression Check', () => {
  it('should allow reading files within allowed paths', () => {
    const testFile = path.join(allowedDir, 'readme.txt')
    fs.writeFileSync(testFile, 'Hello, World!')

    const result = readFile(testFile, [allowedDir])
    expect(result.success).toBe(true)
    expect((result.result as { content: string }).content).toBe('Hello, World!')
  })

  it('should allow writing files within allowed paths', () => {
    const testFile = path.join(allowedDir, 'output.txt')
    const result = writeFile(testFile, 'New content', [allowedDir])
    expect(result.success).toBe(true)
    expect(fs.readFileSync(testFile, 'utf-8')).toBe('New content')
  })

  it('should allow editing files within allowed paths', () => {
    const testFile = path.join(allowedDir, 'editable.txt')
    fs.writeFileSync(testFile, 'foo bar baz')

    const result = editFile(testFile, 'bar', 'qux', [allowedDir])
    expect(result.success).toBe(true)
    expect(fs.readFileSync(testFile, 'utf-8')).toBe('foo qux baz')
  })

  it('should block reading files outside allowed paths', () => {
    const secretFile = path.join(outsideDir, 'secret.txt')
    fs.writeFileSync(secretFile, 'SECRET')

    const result = readFile(secretFile, [allowedDir])
    expect(result.success).toBe(false)
    expect(result.error).toContain('outside allowed directories')
  })

  it('should block writing files outside allowed paths', () => {
    const secretFile = path.join(outsideDir, 'hack.txt')
    const result = writeFile(secretFile, 'HACKED', [allowedDir])
    expect(result.success).toBe(false)
    expect(result.error).toContain('outside allowed directories')
  })

  it('should reject paths when no allowed paths configured', () => {
    const result = validatePath('/any/path', [])
    expect(result.valid).toBe(false)
    expect(result.error).toContain('No allowed paths configured')
  })

  it('should handle path traversal attempts', () => {
    const traversal = path.join(allowedDir, '..', 'outside', 'secret.txt')
    const result = validatePath(traversal, [allowedDir])
    expect(result.valid).toBe(false)
    expect(result.error).toContain('outside allowed directories')
  })

  it('should allow line-range reads', () => {
    const testFile = path.join(allowedDir, 'multiline.txt')
    fs.writeFileSync(testFile, 'line1\nline2\nline3\nline4\nline5')

    const result = readFile(testFile, [allowedDir], 2, 4)
    expect(result.success).toBe(true)
    expect((result.result as { content: string }).content).toBe('line2\nline3\nline4')
  })

  it('should allow search with safe patterns', () => {
    const testFile = path.join(allowedDir, 'searchable.txt')
    fs.writeFileSync(testFile, 'function hello() {\n  return "world"\n}')

    const result = searchFiles(allowedDir, 'function', [allowedDir])
    expect(result.success).toBe(true)
    const matches = (result.result as { matches: unknown[] }).matches
    expect(matches.length).toBeGreaterThan(0)
  })
})
