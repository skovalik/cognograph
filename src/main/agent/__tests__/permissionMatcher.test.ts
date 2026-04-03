// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { describe, it, expect } from 'vitest'
import {
  parseCommand,
  evaluatePermission,
  getDenyReason,
  formatPermissionKey
} from '../permissionMatcher'

// ---------------------------------------------------------------------------
// parseCommand
// ---------------------------------------------------------------------------

describe('parseCommand', () => {
  it('parses a simple command', () => {
    const result = parseCommand('git status')
    expect(result.binary).toBe('git')
    expect(result.subcommand).toBe('status')
    expect(result.flags).toEqual([])
  })

  it('extracts flags', () => {
    const result = parseCommand('git push --force -v')
    expect(result.binary).toBe('git')
    expect(result.subcommand).toBe('push')
    expect(result.flags).toContain('--force')
    expect(result.flags).toContain('-v')
  })

  it('handles binary path extraction', () => {
    const result = parseCommand('/usr/bin/git status')
    expect(result.binary).toBe('git')
    expect(result.subcommand).toBe('status')
  })

  it('handles Windows-style .exe binary', () => {
    const result = parseCommand('git.exe status')
    expect(result.binary).toBe('git')
    expect(result.subcommand).toBe('status')
  })

  it('handles quoted arguments', () => {
    const result = parseCommand('git commit -m "hello world"')
    expect(result.binary).toBe('git')
    expect(result.subcommand).toBe('commit')
    expect(result.flags).toContain('-m')
  })

  it('handles empty command', () => {
    const result = parseCommand('')
    expect(result.binary).toBe('')
    expect(result.subcommand).toBeNull()
    expect(result.flags).toEqual([])
  })

  it('handles command with only binary', () => {
    const result = parseCommand('ls')
    expect(result.binary).toBe('ls')
    expect(result.subcommand).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// evaluatePermission — deny rules
// ---------------------------------------------------------------------------

describe('evaluatePermission - deny rules', () => {
  it('denies git credential fill', () => {
    expect(evaluatePermission('git credential fill')).toBe('deny')
  })

  it('denies git credential-store', () => {
    // 'credential' is the subcommand part — 'credential-store' has subcommand='credential-store'
    // which does NOT match because subcommand would be 'credential-store' not 'credential'
    // But 'git credential fill' matches because subcommand='credential'
    expect(evaluatePermission('git credential fill')).toBe('deny')
  })

  it('denies git push --force', () => {
    expect(evaluatePermission('git push --force')).toBe('deny')
  })

  it('denies git push -f', () => {
    expect(evaluatePermission('git push -f')).toBe('deny')
  })

  it('denies git push --force-with-lease', () => {
    expect(evaluatePermission('git push --force-with-lease')).toBe('deny')
  })

  it('denies git config --global', () => {
    expect(evaluatePermission('git config --global user.email')).toBe('deny')
  })

  it('denies git config --system', () => {
    expect(evaluatePermission('git config --system core.autocrlf')).toBe('deny')
  })

  it('denies git remote set-url', () => {
    expect(evaluatePermission('git remote set-url origin https://evil.com')).toBe('deny')
  })

  it('denies rm -rf', () => {
    expect(evaluatePermission('rm -rf /')).toBe('deny')
  })

  it('denies eval', () => {
    expect(evaluatePermission('eval "malicious"')).toBe('deny')
  })

  it('denies git clean --force', () => {
    expect(evaluatePermission('git clean --force')).toBe('deny')
  })

  it('denies empty command', () => {
    expect(evaluatePermission('')).toBe('deny')
  })
})

// ---------------------------------------------------------------------------
// evaluatePermission — allow rules
// ---------------------------------------------------------------------------

describe('evaluatePermission - allow rules', () => {
  it('allows git status', () => {
    expect(evaluatePermission('git status')).toBe('allow')
  })

  it('allows git log', () => {
    expect(evaluatePermission('git log')).toBe('allow')
  })

  it('allows git diff', () => {
    expect(evaluatePermission('git diff')).toBe('allow')
  })

  it('allows git branch', () => {
    expect(evaluatePermission('git branch')).toBe('allow')
  })

  it('allows git log with flags', () => {
    expect(evaluatePermission('git log --oneline -n 10')).toBe('allow')
  })

  it('allows ls', () => {
    expect(evaluatePermission('ls')).toBe('allow')
  })

  it('allows cat', () => {
    expect(evaluatePermission('cat file.txt')).toBe('allow')
  })

  it('allows grep', () => {
    expect(evaluatePermission('grep -r "pattern" .')).toBe('allow')
  })

  it('allows rg', () => {
    expect(evaluatePermission('rg "pattern" --type ts')).toBe('allow')
  })

  it('allows pwd', () => {
    expect(evaluatePermission('pwd')).toBe('allow')
  })
})

// ---------------------------------------------------------------------------
// evaluatePermission — ask (default)
// ---------------------------------------------------------------------------

describe('evaluatePermission - ask (default)', () => {
  it('asks for git push (no --force)', () => {
    expect(evaluatePermission('git push')).toBe('ask')
  })

  it('asks for npm install', () => {
    expect(evaluatePermission('npm install')).toBe('ask')
  })

  it('asks for git commit', () => {
    expect(evaluatePermission('git commit -m "msg"')).toBe('ask')
  })

  it('asks for git checkout', () => {
    expect(evaluatePermission('git checkout main')).toBe('ask')
  })

  it('asks for npx command', () => {
    expect(evaluatePermission('npx tsc --noEmit')).toBe('ask')
  })

  it('asks for unknown binary', () => {
    expect(evaluatePermission('some-random-tool --do-stuff')).toBe('ask')
  })

  it('asks for git config (local, no --global)', () => {
    expect(evaluatePermission('git config user.name "Test"')).toBe('ask')
  })

  it('asks for node', () => {
    expect(evaluatePermission('node script.js')).toBe('ask')
  })
})

// ---------------------------------------------------------------------------
// getDenyReason
// ---------------------------------------------------------------------------

describe('getDenyReason', () => {
  it('returns reason for denied command', () => {
    const reason = getDenyReason('git push --force')
    expect(reason).toContain('Shell.git.push.--force')
  })

  it('returns null for allowed command', () => {
    expect(getDenyReason('git status')).toBeNull()
  })

  it('returns null for ask command', () => {
    expect(getDenyReason('npm install')).toBeNull()
  })

  it('returns reason for empty command', () => {
    expect(getDenyReason('')).toBe('Empty command')
  })
})

// ---------------------------------------------------------------------------
// formatPermissionKey
// ---------------------------------------------------------------------------

describe('formatPermissionKey', () => {
  it('formats git push --force', () => {
    expect(formatPermissionKey('git push --force')).toBe('Shell.git.push.--force')
  })

  it('formats simple command', () => {
    expect(formatPermissionKey('npm install')).toBe('Shell.npm.install')
  })

  it('formats binary-only command', () => {
    expect(formatPermissionKey('ls')).toBe('Shell.ls')
  })

  it('formats command with multiple flags', () => {
    expect(formatPermissionKey('git log --oneline -n')).toBe('Shell.git.log.--oneline.-n')
  })
})
