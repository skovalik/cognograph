import * as pty from 'node-pty'
import os from 'os'

interface PtySession {
  id: string
  process: pty.IPty
  cwd: string
}

const sessions = new Map<string, PtySession>()

export function createSession(sessionId: string, cwd?: string): PtySession {
  const shell = os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash'
  const workDir = cwd || os.homedir()

  const proc = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 30,
    cwd: workDir,
    env: process.env as Record<string, string>,
  })

  const session: PtySession = { id: sessionId, process: proc, cwd: workDir }
  sessions.set(sessionId, session)
  return session
}

export function getSession(sessionId: string): PtySession | undefined {
  return sessions.get(sessionId)
}

export function destroySession(sessionId: string): void {
  const session = sessions.get(sessionId)
  if (session) {
    session.process.kill()
    sessions.delete(sessionId)
  }
}

export function resizeSession(sessionId: string, cols: number, rows: number): void {
  const session = sessions.get(sessionId)
  if (session) session.process.resize(cols, rows)
}

export function destroyAll(): void {
  for (const [id] of sessions) destroySession(id)
}
