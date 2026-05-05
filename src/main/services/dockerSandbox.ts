// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital
//
// dockerSandbox.ts — Docker-backed terminal sandbox. Containerizes PTY
// execution so an agent inside Cognograph can't `touch /etc/foo` or
// `curl evil.example` from the host.
//
// ============================================================================
// Default decisions (override path documented per item)
// ============================================================================
//
// Decision 1 — BASE IMAGE
//   Default: build own minimal `ubuntu:24.04 + node:20 + git + curl` and
//   publish to a project-controlled GHCR at a pinned SHA-256 digest.
//   Rejected: ghcr.io/anthropics/claude-code-sandbox:latest — flagged as
//   "unverified, no public record of Anthropic publishing under that
//   path"; pinning to it means trusting a path with no provenance trail.
//   Override: change BASE_IMAGE_REF to the verified Anthropic path once
//   it lands publicly + a SHA-256 is recorded.
//
// Decision 2 — NETWORK ALLOWLIST MECHANISM
//   Default: Docker custom bridge + DNS filter (cross-platform — works on
//   Windows / macOS / Linux via Docker Desktop's resolver). Rejected:
//   iptables — Linux-only; would lock out Stefan's Windows dev box and
//   macOS clients. The DNS-filter approach is implemented in
//   src/main/sandbox/allowlist.ts.
//   Override: an alternative iptables-based strategy can replace
//   `applyNetworkAllowlist` if Linux-only deployment becomes the target.
//
// Decision 3 — OPT-IN DEFAULT
//   Default: per-node toggle (TerminalNode settings drawer checkbox) with
//   workspace-wide "Pro security mode" fallback. When workspace = pro,
//   nodes default to sandboxed=true; operators can opt OUT per node for
//   debugging. When workspace = free, nodes default to sandboxed=false;
//   operators can opt IN per node. Decision 4B: "degrade to unsandboxed
//   PTY with banner if Docker absent".
//
// ============================================================================
// Initial ship contract (deferred follow-up noted)
// ============================================================================
// This module ships at the wiring tier — it exposes the contract surface
// (probe / launch / allowlist resolution / opt-in resolver) and is unit-
// tested at that layer. The end-to-end test (real Docker daemon →
// `touch /etc/foo` denied → `curl evil.example` blocked) requires a
// Playwright + Docker fixture startup-suite framework and is deferred
// to a follow-up. Acceptance test asserts the contract surface; runtime
// integration into registerTerminalHandlers.ts ships guarded by
// `dockerAvailable && node.data.sandboxed === true` so the non-sandboxed
// path (current default for free-tier workspaces) is untouched until
// opt-in is flipped.

import { execSync } from 'node:child_process'
import { type AllowlistEntry, DEFAULT_ALLOWLIST, toDockerDnsFilter } from '../sandbox/allowlist'

// Pinned digest will be filled in once we publish the image to GHCR.
// Until then, sandboxed=true with this BASE_IMAGE_REF intentionally
// fails fast (no fallback to :latest — provenance is non-negotiable).
export const BASE_IMAGE_REF = 'ghcr.io/cognograph/sandbox-ubuntu24-node20:TBD'
export const BASE_IMAGE_DIGEST_REQUIRED = true

export interface SandboxLaunchOptions {
  /** Workspace dir to mount read-write at /workspace. */
  workspaceDir: string
  /** Per-launch hostname override; defaults to "cognograph-sandbox-<short-id>". */
  hostname?: string
  /** Allowlist entries; defaults to DEFAULT_ALLOWLIST. */
  allowlist?: AllowlistEntry[]
  /** Container memory cap in MiB; defaults to 1024. */
  memoryMiB?: number
}

export interface SandboxHandle {
  containerId: string
  /** Docker `exec` invocation prefix; the caller appends the user's command. */
  execPrefix: string[]
  /** Cleanup: `docker rm -f` the container. Idempotent. */
  teardown: () => Promise<void>
}

export interface OptInResolver {
  /** Workspace tier that controls the default. */
  workspaceTier: 'free' | 'pro'
  /** Per-node override. When undefined, falls back to the workspace default. */
  nodeSandboxedOverride?: boolean
}

/**
 * Resolve the effective sandbox flag for a terminal node. Per Decision 3
 * above — workspace tier sets the default, per-node override can flip
 * either direction.
 */
export function resolveSandboxOptIn(opts: OptInResolver): boolean {
  if (opts.nodeSandboxedOverride !== undefined) return opts.nodeSandboxedOverride
  return opts.workspaceTier === 'pro'
}

/**
 * Probe whether Docker is reachable. Used at Cognograph boot; if false,
 * sandboxed=true nodes degrade to unsandboxed PTY with a banner per
 * Stefan decision #4B.
 */
export function probeDockerAvailable(): boolean {
  try {
    execSync('docker info', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

/**
 * Compute the Docker run argv that would launch a sandboxed shell.
 * Returns the argv WITHOUT actually invoking Docker — the live launch
 * is wired in registerTerminalHandlers.ts at the runtime integration
 * point (deferred — see archived design notes). This pure function is
 * the unit under acceptance test.
 */
export function computeLaunchArgv(opts: SandboxLaunchOptions): string[] {
  if (BASE_IMAGE_DIGEST_REQUIRED && BASE_IMAGE_REF.endsWith(':TBD')) {
    throw new Error(
      `BASE_IMAGE_REF (${BASE_IMAGE_REF}) must be replaced with a pinned SHA-256 digest before launching a sandbox. ` +
        'Per Decision 1: build + publish ubuntu24-node20 image to GHCR; record digest here.',
    )
  }
  const hostname = opts.hostname ?? `cognograph-sandbox-${Math.random().toString(36).slice(2, 8)}`
  const memory = `${opts.memoryMiB ?? 1024}m`
  const allowlist = opts.allowlist ?? DEFAULT_ALLOWLIST
  const dnsHosts = toDockerDnsFilter(allowlist)
  return [
    'docker',
    'run',
    '--rm',
    '-d',
    '--hostname',
    hostname,
    '--memory',
    memory,
    '--memory-swap',
    memory, // disallow swap
    '-v',
    `${opts.workspaceDir}:/workspace:rw`,
    // Network: custom bridge with DNS-allowlist filter (Decision 2).
    // The bridge is created out-of-band via `docker network create`
    // with `--internal` semantics + an `--add-host` map for each
    // allowed FQDN. dnsHosts is the ordered hostname list.
    '--network',
    `cognograph-sandbox-net`,
    ...dnsHosts.flatMap((h) => ['--add-host', `${h}:127.0.0.1`]).slice(0, 0), // placeholder; live wire-in TBD
    BASE_IMAGE_REF,
    // Long-lived sleep keeps the container alive; `docker exec` adapter
    // attaches a PTY for each node use.
    'sleep',
    'infinity',
  ]
}

/**
 * Live launch path. Stub for the initial wiring tier — the real implementation must:
 *   1. Verify Docker is available (probeDockerAvailable).
 *   2. Ensure the cognograph-sandbox-net network exists (create if
 *      absent, with custom DNS resolver bound to allowlist).
 *   3. Run computeLaunchArgv → docker daemon, capture container ID.
 *   4. Wire teardown to `docker rm -f <containerId>` on node-delete /
 *      app-quit.
 * Live wire-in is deferred — this stub throws to make accidental
 * "I'll just call this" usage fail fast.
 */
export async function launchSandbox(_opts: SandboxLaunchOptions): Promise<SandboxHandle> {
  throw new Error(
    'dockerSandbox.launchSandbox: live launch path is deferred to a follow-up. ' +
      'Use computeLaunchArgv for argv generation; wire registerTerminalHandlers.ts ' +
      'integration in a follow-up commit once the GHCR image is published with a ' +
      'pinned SHA-256 digest.',
  )
}
