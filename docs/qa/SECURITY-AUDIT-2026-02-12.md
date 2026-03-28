# Security Audit Report — 2026-02-12

**Auditor:** Enterprise Hardening Track (Week 4 Stream B)
**Scope:** Dependency vulnerabilities, IPC validation, memory leaks
**Grade:** B+ (Good, some improvements needed)

---

## npm audit Results

**Total vulnerabilities:** 5 (1 low, 4 moderate)
**Critical/High:** 0 ✅
**Recommendation:** Defer to v0.1.1 (all moderate severity, low risk)

### CVE-1: electron <35.7.5 (GHSA-vmqv-hx8q-j7mg)
- **Severity:** Moderate (CVSS 6.1/10)
- **Issue:** ASAR Integrity Bypass via resource modification
- **Impact:** Attacker with local file access can modify app resources
- **Risk:** LOW (requires local access, internal tool)
- **Fix:** Upgrade to electron@40.4.0 (MAJOR version, breaking changes likely)
- **Decision:** **DEFER to v0.1.1** (test breaking changes post-launch)

### CVE-2: prismjs <1.30.0 (GHSA-x7hr-w5r2-h6wg)
- **Severity:** Moderate (CVSS 4.9/10)
- **Issue:** DOM Clobbering vulnerability
- **Impact:** Theoretical XSS if attacker controls syntax-highlighted content
- **Risk:** LOW (internal tool, no untrusted input)
- **Fix:** Upgrade react-syntax-highlighter to v16.1.0
- **Decision:** **DEFER to v0.1.1** (low risk for internal use)

### CVE-3: qs 6.7.0-6.14.1 (GHSA-w7fw-mjwx-w883)
- **Severity:** Low-Moderate (CVSS 3.7/10)
- **Issue:** arrayLimit bypass via comma parsing (DoS)
- **Impact:** DoS if attacker sends malicious query string
- **Risk:** VERY LOW (no user-facing API)
- **Fix:** `npm audit fix` (non-breaking)
- **Decision:** **FIX NOW** (simple upgrade)

---

## IPC Input Validation Status

**Total handlers:** 65
**Validated:** 28 (43%)
**Unvalidated:** 37 (57%)

### Validated Handlers (Zod schemas exist) ✅
- workspace.ts: load, save, create, list (4 handlers)
- templates.ts: save, load, list (3 handlers)
- multiplayer.ts: connect, sync (8 handlers)
- settings.ts: get, set (6 handlers)
- Other: 7 handlers

### Unvalidated Handlers (Need Zod schemas) ⚠️

**Critical (user input):**
- `llm:send` — No validation on messages array, provider enum
- `orchestrator:execute` — No validation on config (could be malicious)
- `fs:readFile` / `fs:writeFile` — Path validation exists but no Zod schema
- `agent:run` — No validation on agent config

**Medium (internal):**
- Various AI editor handlers
- Action executor handlers
- Template handlers (some)

**Recommendation:** Add Zod schemas for 12 critical handlers (3-4h), defer rest to v0.1.1

---

## Memory Leak Scan

**useEffect hooks analyzed:** 280+
**With cleanup:** 260 (93%)
**Missing cleanup:** 20 (7%)

### High-Priority Fixes (5 hooks)

1. **NodeModeDropdown.tsx:102** — setTimeout not cleaned
2. **AmbientEffectLayer.tsx:78** — requestAnimationFrame in 3 effects
3. **orchestratorStore.ts:183** — workspaceStore.subscribe never unsubscribed
4. **useActionSubscription.ts:45** — EventTarget listener (has cleanup ✅)
5. **FluidGlassShimmer.tsx:96** — requestAnimationFrame (has cleanup ✅)

**Actually:** Only 3 real leaks (NodeModeDropdown, AmbientEffectLayer, orchestratorStore)

**Recommendation:** Fix 3 critical leaks (30min), audit rest post-launch

---

## Security Score: B+ (82/100)

**Strengths:**
- ✅ API keys encrypted (electron-store + safeStorage)
- ✅ Path traversal protection exists
- ✅ MCP debug server dev-only, token-based auth
- ✅ Code injection clean (0 eval, 0 innerHTML)
- ✅ Most common handlers validated (43%)

**Improvements needed:**
- ⚠️ 37 unvalidated IPC handlers (12 critical)
- ⚠️ 3 memory leaks (minor but should fix)
- ⚠️ 4 moderate CVEs (all deferrable)

**Recommendation for v0.1.0:**
- Fix qs CVE (simple, non-breaking)
- Add Zod schemas for 12 critical IPC handlers (3-4h)
- Fix 3 memory leaks (30min)
- Defer electron/prismjs CVEs to v0.1.1 (breaking changes)

**Total:** 4-5h security work for v0.1.0

---

## Next Steps

1. ✅ Security audit complete (documented above)
2. ⏳ Execute quick fixes (qs CVE + 3 memory leaks) — 30min
3. ⏳ Add Zod schemas for 12 critical handlers — 3-4h
4. ✅ Mark remaining CVEs as "defer to v0.1.1"

**Proceeding with fixes now...**
