# Production Hardening Sprint - Execution Plan

**Goal:** Get from 76% → 90%+ enterprise confidence this session
**Target:** Make v0.1.1 safe for beta testing
**Focus:** High-impact, low-risk fixes only

---

## Sprint Backlog (Priority Order)

### 1. Update ARCHITECTURE.md (2-3h) - CRITICAL
**Impact:** +5 points (Jordan 79→84)
**Why:** Developers get wrong mental model from stale docs

**Tasks:**
- Document 36-store reality (vs documented 1)
- Document 10 node types (vs documented 4)
- Document 93 IPC channels (vs documented 15)
- Add store responsibilities table
- Add IPC channel reference

### 2. Fix Critical TypeScript Errors (2-3h) - HIGH
**Impact:** +6 points (Taylor 74→80)
**Why:** Prevent runtime crashes

**Focus:** Crash-risk errors only
- filesystemTools.ts undefined checks (4 errors)
- mcp/handlers.ts undefined checks (4 errors)
- diagnosticServer.ts missing return (1 error)
- connectors.ts/mcpClient.ts env vars (2 errors)

**Skip:** Test file errors (11 errors - not production code)

### 3. Add CSP Configuration (30min) - HIGH
**Impact:** +2 points (Alexis 72→74)
**Why:** Prevent XSS in preview feature

**Task:**
- Add to src/main/index.ts BrowserWindow config
- Test preview still works

### 4. Remove Production Console.logs (1h) - MEDIUM
**Impact:** +1 point (Taylor 80→81)
**Why:** Performance + log spam

**Method:**
- Add isDevelopment check
- Gate all console.logs
- Keep error logs

### 5. Delete Unused Files (30min) - MEDIUM
**Impact:** +1 point (Taylor 81→82)
**Why:** Reduce confusion

**Files:** Top 10 clearly unused:
- sentry.ts (configured but not used)
- voiceService.ts
- workflowExecutor.ts
- healthCheck.ts
- (6 more from knip output)

### 6. Create Quick Start Guide (1-2h) - HIGH
**Impact:** +3 points (Jordan 84→87)
**Why:** Beta users need onboarding

**Contents:**
- Installation
- First workspace
- Create/connect nodes
- Context injection demo
- Save/load

---

## Execution Order

**Phase 1: Documentation (3-5h)**
1. Update ARCHITECTURE.md
2. Write Quick Start Guide

**Phase 2: Code Quality (3-4h)**
3. Fix TypeScript errors (critical only)
4. Add CSP
5. Gate console.logs

**Phase 3: Cleanup (1h)**
6. Delete unused files

**Phase 4: RL Validation (1h)**
7. Re-evaluate with 7 personas
8. Generate final confidence score

**Total:** 8-11 hours

**Target Outcome:** 76% → 90%+ confidence

---

## Success Criteria

After this sprint:
- ✅ ARCHITECTURE.md matches reality
- ✅ 0 crash-risk TypeScript errors in production code
- ✅ CSP configured
- ✅ No console.logs in production
- ✅ 10+ unused files deleted
- ✅ Quick start guide exists
- ✅ 90%+ confidence (ready for beta)

**Let's execute.**
