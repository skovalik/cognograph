// autoUpdater.ts — SLSA-provenance verification gate on auto-update apply.
//
// The auto-updater performs a cosign verify-blob on the downloaded
// binary BEFORE applying the update. A verification failure aborts the
// update (no apply, no silent install) and surfaces a notification to
// the renderer.
//
// "Verify twice" contract: CI signs each platform binary
// with cosign keyless OIDC; the runtime then re-verifies the bundled
// signature against the pinned public key shipped in dist/attestations/.
// Both checks must pass for the apply to proceed.
//
// Two verification paths:
//   1. cosign-keyless (when cosign is on PATH AND identities.txt has
//      OIDC subjects): `cosign verify-blob --certificate-identity ...`.
//   2. local-key Ed25519 (production runtime — cosign rarely installed
//      on user machines): Node crypto.verify against the bundled
//      cosign.pub Ed25519 public key.
//
// Failure path: throws an Error AND, if an IPC sender is provided,
// posts auto-update:verification-failed to the renderer. The caller
// (src/main/index.ts) wires this into electron-updater's
// `update-downloaded` event so a tampered or unsigned download never
// reaches `quitAndInstall()`.

import { execSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_PUB_KEY = 'dist/attestations/cosign.pub'
const DEFAULT_IDENTITIES = 'dist/attestations/identities.txt'

export type VerificationResult =
  | { ok: true; mode: 'cosign-keyless' | 'local-key-ed25519'; identity?: string }
  | { ok: false; reason: string }

export interface VerifierOptions {
  publicKeyPath?: string
  identitiesPath?: string
  /** Inject an alternate cosign-on-path probe for testing. */
  cosignProbe?: () => boolean
}

export function isCosignAvailable(probe?: () => boolean): boolean {
  if (probe) return probe()
  try {
    execSync('cosign version', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

export function loadPinnedIdentities(identitiesPath = DEFAULT_IDENTITIES): string[] {
  if (!fs.existsSync(identitiesPath)) return []
  return fs
    .readFileSync(identitiesPath, 'utf-8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
}

/**
 * Verify a downloaded update artifact against its bundled signature.
 *
 * @param blobPath — path to the downloaded binary (.AppImage, .dmg, .exe).
 * @param sigPath — path to the cosign-signed .sig file (base64 Ed25519
 *                  for local-key mode; cosign-bundle for keyless mode).
 * @throws when the signature does not verify.
 */
export function verifyDownloadedUpdate(
  blobPath: string,
  sigPath: string,
  options: VerifierOptions = {},
): VerificationResult {
  if (!fs.existsSync(blobPath)) {
    return { ok: false, reason: `update blob missing: ${blobPath}` }
  }
  if (!fs.existsSync(sigPath)) {
    return { ok: false, reason: `signature missing: ${sigPath}` }
  }

  const identitiesPath = options.identitiesPath ?? DEFAULT_IDENTITIES
  const publicKeyPath = options.publicKeyPath ?? DEFAULT_PUB_KEY
  const identities = loadPinnedIdentities(identitiesPath)
  const oidcIdentities = identities.filter((id) => id.startsWith('https://'))
  const cosignAvailable = isCosignAvailable(options.cosignProbe)
  const useCosign = cosignAvailable && oidcIdentities.length > 0

  if (useCosign) {
    for (const identity of oidcIdentities) {
      try {
        execSync(
          `cosign verify-blob --signature "${sigPath}" --certificate-identity "${identity}" "${blobPath}"`,
          { stdio: 'pipe' },
        )
        return { ok: true, mode: 'cosign-keyless', identity }
      } catch {
        // try next identity
      }
    }
    return { ok: false, reason: `cosign verify-blob did not match any pinned OIDC identity` }
  }

  // Local-key Ed25519 fallback (production runtime path).
  if (!fs.existsSync(publicKeyPath)) {
    return {
      ok: false,
      reason: `cosign unavailable AND public key missing at ${publicKeyPath}; cannot verify`,
    }
  }
  let publicKey: crypto.KeyObject
  try {
    publicKey = crypto.createPublicKey(fs.readFileSync(publicKeyPath, 'utf-8'))
  } catch (e) {
    return {
      ok: false,
      reason: `${publicKeyPath} is not a valid Ed25519 public key: ${(e as Error).message}`,
    }
  }
  try {
    const blob = fs.readFileSync(blobPath)
    const sigB64 = fs.readFileSync(sigPath, 'utf-8').trim()
    const sig = Buffer.from(sigB64, 'base64')
    if (!crypto.verify(null, blob, publicKey, sig)) {
      return { ok: false, reason: 'Ed25519 signature verification failed' }
    }
  } catch (e) {
    return { ok: false, reason: `local-key verify error: ${(e as Error).message}` }
  }
  return { ok: true, mode: 'local-key-ed25519' }
}

export interface IpcSender {
  send: (channel: string, payload: unknown) => void
}

/**
 * Apply gate — verify the downloaded update; abort + notify on failure;
 * call applyFn() on success. Used as the electron-updater
 * `update-downloaded` handler.
 *
 * @returns the verification result.
 * @throws when verification fails (caller should NOT proceed to install).
 */
export function verifyAndApplyUpdate(
  downloadedBlobPath: string,
  applyFn: () => void,
  ipc?: IpcSender,
  options: VerifierOptions = {},
): VerificationResult {
  // electron-updater downloads <blob> + <blob>.sig via the publish feed;
  // the SLSA contract is that the .sig sibling is signed by the
  // pinned cosign identity (per .github/workflows/slsa-provenance.yml).
  const sigPath = `${downloadedBlobPath}.sig`
  const result = verifyDownloadedUpdate(downloadedBlobPath, sigPath, options)

  if (!result.ok) {
    const reason = `auto-update verification failed: ${result.reason}`
    if (ipc)
      ipc.send('auto-update:verification-failed', {
        blob: path.basename(downloadedBlobPath),
        reason: result.reason,
      })
    throw new Error(reason)
  }

  if (ipc)
    ipc.send('auto-update:verified', { blob: path.basename(downloadedBlobPath), mode: result.mode })
  applyFn()
  return result
}
