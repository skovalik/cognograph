// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital
//
// allowlist.ts — Network egress allowlist for Docker-sandboxed terminal
// nodes. Used by dockerSandbox.ts to construct the Docker custom-bridge
// + DNS filter rules that gate outbound connections.
//
// Design decision (default, override-able):
//   Default network strategy = Docker custom bridge + DNS filter
//   (cross-platform). Rejected: iptables (Linux-only — locks out
//   Stefan's Windows dev box and macOS clients). The bridge approach
//   uses Docker Desktop's built-in DNS resolver to whitelist FQDNs;
//   non-resolved hostnames return NXDOMAIN inside the container.
//
// Override path: replace this allowlist's resolution strategy with an
// iptables-based one if Linux-only deployment becomes the target.

export interface AllowlistEntry {
  /** FQDN or wildcard pattern (e.g. "api.anthropic.com" or "*.npmjs.org"). */
  host: string
  /** Optional port restriction; defaults to 443 (HTTPS only). */
  port?: number
  /** Why this host is on the allowlist (for audit + review). */
  reason: string
}

/**
 * Default allowlist for sandboxed terminal nodes. Conservative by
 * design — operators add hosts via per-workspace settings, not by
 * editing this file at runtime.
 *
 * Hosts here are the minimum surface for: (a) AI provider API calls
 * the agent makes from inside a sandbox, (b) package-manager fetches
 * for legitimate workflow setup. Anything outside this set is denied
 * by default (deny-by-default; allow only what's enumerated).
 */
export const DEFAULT_ALLOWLIST: AllowlistEntry[] = [
  { host: 'api.anthropic.com', reason: 'Claude API — primary agent provider' },
  { host: 'generativelanguage.googleapis.com', reason: 'Gemini API — secondary agent provider' },
  { host: 'api.openai.com', reason: 'OpenAI API — tertiary agent provider' },
  { host: '*.npmjs.org', reason: 'npm registry — package fetch' },
  { host: 'registry.npmjs.org', reason: 'npm registry — package fetch (canonical)' },
  { host: 'github.com', port: 443, reason: 'git fetch over HTTPS' },
  { host: '*.githubusercontent.com', reason: 'GitHub raw content — git LFS, release assets' },
  { host: 'pypi.org', reason: 'Python package index' },
  { host: 'files.pythonhosted.org', reason: 'PyPI package downloads' },
]

/**
 * Resolve a host against the allowlist. Returns true if the host
 * matches an enumerated entry (exact or wildcard).
 *
 * Wildcard semantics: `*.example.com` matches any single subdomain
 * level (e.g. `foo.example.com` matches, but `foo.bar.example.com`
 * does NOT match `*.example.com` — use `**.example.com` for
 * multi-level if needed; not currently supported).
 */
export function isHostAllowed(
  host: string,
  allowlist: AllowlistEntry[] = DEFAULT_ALLOWLIST,
): boolean {
  for (const entry of allowlist) {
    if (entry.host === host) return true
    if (entry.host.startsWith('*.')) {
      const suffix = entry.host.slice(1) // ".example.com"
      if (host.endsWith(suffix) && host.length > suffix.length) {
        const prefix = host.slice(0, host.length - suffix.length)
        if (!prefix.includes('.')) return true
      }
    }
  }
  return false
}

/**
 * Convert the allowlist to Docker DNS filter rules format. Used by
 * dockerSandbox.ts when constructing the per-sandbox custom bridge.
 *
 * Docker's `--dns` + DNS-resolver allow strategy: the sandbox
 * network's resolver returns NXDOMAIN for any host outside the
 * allowlist, blocking the resolution before a TCP connect is even
 * attempted. This is a defense-in-depth layer above any application-
 * level URL filtering.
 */
export function toDockerDnsFilter(allowlist: AllowlistEntry[] = DEFAULT_ALLOWLIST): string[] {
  return allowlist.map((entry) => entry.host)
}
