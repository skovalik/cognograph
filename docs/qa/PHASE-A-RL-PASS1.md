# Ralph Loop Pass 1: Phase A Action Plan Evaluation

**Document:** `docs/qa/PHASE-A-ACTION-PLAN-v1.md`
**Personas:** 7 (Steve, Quinn, Chen, Jake, Sage, Morgan, Sam)
**Evaluation Date:** 2026-02-13

---

## Persona 1: Steve (Hardening Engineer)

**Focus:** Edge cases, error handling, robustness

### Evaluation Score: 78/100

**Strengths:**
- ✅ Root cause analysis is thorough with code references
- ✅ Fix strategies are concrete
- ✅ Validation steps included

**Critical Issues:**

1. **Fix 2 is Incomplete (P0)**
   - Plan says "Root Cause Hypothesis" and "Likely Fix"
   - This is NOT verified - it's guesswork!
   - Need to actually trace the bug before proposing fix
   - **Impact:** Could waste hours implementing wrong fix
   - **Score Impact:** -10 points

2. **ContextIndicator Implementation Missing (P1)**
   - Shows interface but not the BFS logic
   - "... BFS to find connected nodes ..." is a TODO comment!
   - Need actual implementation of context source calculation
   - **Impact:** Implementer has to figure it out
   - **Score Impact:** -5 points

3. **No Error Boundary Around New Components (P1)**
   - ContextIndicator could crash if getContextForNode throws
   - AgentActivityBadge could crash if orchestratorStore has bad data
   - BridgeStatusBar could crash if runs array malformed
   - **Impact:** One bad component crashes entire app
   - **Recommendation:** Wrap all new components in ErrorBoundary
   - **Score Impact:** -3 points

4. **No Type Guards on OrchestratorStatusUpdate (P2)**
   - Preload IPC handler assumes update is correctly typed
   - Main could send malformed data
   - No validation before passing to store
   - **Recommendation:** Add Zod schema validation or type guards
   - **Score Impact:** -2 points

5. **Context UI Performance Not Analyzed (P2)**
   - ContextIndicator recalculates BFS on every render if not memoized correctly
   - Dependency array includes `nodes, edges` which change frequently
   - Could cause performance regression
   - **Recommendation:** Use stable selector, not full arrays
   - **Score Impact:** -2 points

**Recommendations:**
1. Debug Fix 2 properly - trace execution, find exact bug
2. Implement full ContextIndicator logic (don't leave TODOs)
3. Add error boundaries to all new components
4. Add IPC payload validation
5. Optimize ContextIndicator dependencies

---

## Persona 2: Quinn (QA Strategist)

**Focus:** Test coverage, validation completeness

### Evaluation Score: 81/100

**Strengths:**
- ✅ Validation steps for each fix
- ✅ Test-driven approach (fix until tests pass)
- ✅ Manual testing checklist

**Critical Issues:**

1. **No Tests for New Components (P0)**
   - ContextIndicator: 0 tests planned
   - AgentActivityBadge: 0 tests planned
   - BridgeStatusBar: 0 tests planned
   - **Impact:** Regressions won't be caught
   - **Recommendation:** Add unit tests for each component
   - **Score Impact:** -8 points

2. **Fix 3 Validation is Only Manual (P1)**
   - "Manual: Create note → conversation edge, verify indicator shows note"
   - No automated test to prevent regression
   - **Recommendation:** Write integration test for ContextIndicator
   - **Score Impact:** -5 points

3. **No Performance Regression Tests (P1)**
   - ContextIndicator could slow down ChatPanel
   - BFS recalculation on every message could be expensive
   - No benchmark baseline captured
   - **Recommendation:** Add performance test (render time < 100ms)
   - **Score Impact:** -3 points

4. **Missing Edge Cases in Validation (P2)**
   - What if getContextForNode throws?
   - What if orchestratorStore.runs is undefined?
   - What if nodes array is massive (10,000 nodes)?
   - **Recommendation:** Add edge case test scenarios
   - **Score Impact:** -3 points

**Recommendations:**
1. Write unit tests for all 3 new components
2. Add integration test for ContextIndicator visibility
3. Add performance regression test for BFS recalculation
4. Document edge cases and add tests

---

## Persona 3: Chen (Systems Architect)

**Focus:** Integration coherence, architectural alignment

### Evaluation Score: 83/100

**Strengths:**
- ✅ Addresses IPC wiring gap systematically
- ✅ Maintains existing store patterns
- ✅ Clean component boundaries

**Critical Issues:**

1. **ContextIndicator Duplicates BFS Logic (P1)**
   - Plan shows: "Calculate context sources (similar to BFS in getContextForNode)"
   - This means DUPLICATE BFS traversal
   - getContextForNode already does BFS → just parse its output!
   - **Impact:** Wasted computation, synchronization risk (two BFS could diverge)
   - **Better Approach:** Parse getContextForNode() output to extract sources
   - **Score Impact:** -7 points

2. **No Initialization Order Specified (P1)**
   - initOrchestratorIPC() must run before OrchestratorNode renders
   - No guarantee of order in plan
   - **Impact:** First render could miss status update
   - **Recommendation:** Specify initialization in App.tsx useEffect with dependencies
   - **Score Impact:** -4 points

3. **BridgeStatusBar Placement in App.tsx (P2)**
   - Adding directly to App.tsx adds to 2,505-line god component
   - Violates "decompose App.tsx" architectural goal
   - **Better:** Create layout component structure first
   - **Score Impact:** -3 points

4. **Missing Store Synchronization Pattern (P2)**
   - orchestratorStore.runs updates when IPC event received
   - What if component queries before event arrives?
   - Need loading state or optimistic update
   - **Score Impact:** -3 points

**Recommendations:**
1. Don't duplicate BFS - parse getContextForNode output instead
2. Specify initialization order in plan
3. Avoid adding to App.tsx monolith
4. Add loading states to handle async IPC

---

## Persona 4: Jake (UX Principal)

**Focus:** User experience of the fixes

### Evaluation Score: 85/100

**Strengths:**
- ✅ Context visibility solves major UX pain point
- ✅ Visual feedback for orchestrator runs
- ✅ Progressive disclosure (indicators only when relevant)

**Critical Issues:**

1. **ContextIndicator is Too Verbose for Frequent Use (P1)**
   - Shows full list above message input in ChatPanel
   - Takes vertical space on EVERY message
   - Could be 5+ lines tall with many context nodes
   - **Impact:** Chat UI becomes cramped
   - **Better:** Compact badge by default, expand on click
   - **Score Impact:** -6 points

2. **No "Why This Context?" Explanation (P2)**
   - User sees "Using context from: Note A"
   - But WHY Note A? Because it's connected? What if multiple paths?
   - **Better:** Show connection path or depth
   - Example: "Note A (1 hop) • Note B (2 hops)"
   - **Score Impact:** -4 points

3. **Status Bar Always Visible When Running (P2)**
   - Covers bottom of canvas
   - Could block view of nodes near bottom
   - **Better:** Collapsible or auto-hide when not interacting
   - **Score Impact:** -3 points

4. **No Loading State on ContextIndicator (P2)**
   - Calculating context could take 50-100ms with large graphs
   - Shows nothing meanwhile
   - **Better:** Skeleton loader or "Calculating context..."
   - **Score Impact:** -2 points

**Recommendations:**
1. Make ContextIndicator compact by default (badge with count)
2. Show connection depth/path in tooltip
3. Make BridgeStatusBar collapsible
4. Add loading skeleton to ContextIndicator

---

## Persona 5: Sage (UX Evaluator)

**Focus:** Holistic experience impact

### Evaluation Score: 82/100

**Strengths:**
- ✅ Addresses core "invisible magic" problem
- ✅ Makes autonomous agents perceivable
- ✅ Fixes real user pain points

**Critical Issues:**

1. **Context Indicator Doesn't Match Mental Model (P1)**
   - Shows flat list: "Note A, Project B, Note C"
   - But connections are GRAPH, not list
   - User mental model: "I connected A → B → C, why does order not show?"
   - **Better:** Show hierarchy or depth grouping
   - **Example:**
     ```
     Depth 1: Note A, Project B
     Depth 2: Note C (via Project B)
     ```
   - **Score Impact:** -7 points

2. **No Feedback Loop (P1)**
   - User sees "Using context from: Note A"
   - Realizes Note A is irrelevant
   - No quick way to disconnect or exclude
   - **Better:** Click context source → options menu (view, edit, disconnect, exclude)
   - **Score Impact:** -5 points

3. **Orchestrator Status Doesn't Show WHAT Agent is Doing (P2)**
   - Badge shows "Step 2: Analysis"
   - But which agent? Agent-1? Agent-2?
   - What is "Analysis" doing?
   - **Better:** Show agent name + current action
   - **Score Impact:** -4 points

4. **No Celebration When Orchestrator Completes (P2)**
   - Run finishes silently
   - Badge disappears
   - User: "Did it work? What happened?"
   - **Better:** Success animation + results summary
   - **Score Impact:** -2 points

**Recommendations:**
1. Show context depth/hierarchy in ContextIndicator
2. Add interaction to context sources (click to view/disconnect)
3. Show agent name + action in orchestrator badge
4. Add completion feedback (toast + results)

---

## Persona 6: Morgan (Product Lead)

**Focus:** Spec alignment, priorities

### Evaluation Score: 79/100

**Strengths:**
- ✅ Fixes align with VISION.md goals
- ✅ Addresses "killer feature visibility" priority
- ✅ Makes autonomous agents tangible

**Critical Issues:**

1. **Missing Spec Coverage Validation (P0)**
   - Plan doesn't verify these fixes actually address spec promises
   - orchestrator-node.md (2,010 lines) - how much does this cover?
   - spatial-extraction-system.md (3,882 lines) - context visibility mentioned?
   - **Impact:** Could fix symptoms, miss spec requirements
   - **Score Impact:** -10 points

2. **No User Story Validation (P1)**
   - Fixes are technical ("wire IPC event")
   - But user stories are behavioral ("I want to see what AI knows")
   - Missing: "After this fix, user can [do X]"
   - **Recommendation:** Add user story acceptance criteria
   - **Score Impact:** -5 points

3. **Context Visibility Doesn't Match VISION.md Promise (P1)**
   - VISION.md says: "Automatic with visibility ('Using context from: Note A, Project B')"
   - Plan implements: Separate component user must look at
   - Better alignment: Inline in chat (like Claude.ai shows "Used artifacts: X")
   - **Score Impact:** -4 points

4. **Orchestrator Spec Says "Visual Pipeline" (P2)**
   - orchestrator-node.md describes step-by-step visual progress
   - Plan only adds status badge
   - Missing: Pipeline visualization showing all agents + steps
   - **Impact:** Spec promises more than plan delivers
   - **Score Impact:** -2 points

**Recommendations:**
1. Cross-reference fixes against specs, validate coverage
2. Add user story acceptance criteria
3. Align context visibility with VISION.md promise
4. Plan includes full pipeline visualization, not just badge

---

## Persona 7: Sam (Integration Specialist)

**Focus:** IPC wiring correctness, store synchronization

### Evaluation Score: 87/100 ⭐ HIGHEST

**Strengths:**
- ✅ Correctly identifies IPC event gap
- ✅ Preload wiring code is accurate
- ✅ Store listener pattern matches existing code
- ✅ Cleanup function for unmounting

**Critical Issues:**

1. **Missing Type Import in Preload (P1)**
   - Plan shows: `onStatusUpdate: (callback: (update: OrchestratorStatusUpdate) => void)`
   - But preload/index.ts doesn't import `OrchestratorStatusUpdate` type
   - TypeScript will error
   - **Fix:** Import from '@shared/types'
   - **Score Impact:** -5 points

2. **Channel Name Mismatch (P0)**
   - Main sends: `'orchestrator:status'`
   - Store expects: `onStatusUpdate` (implies 'orchestrator:status-update'?)
   - Need to verify channel name consistency
   - **Impact:** Events still won't flow if names don't match
   - **Score Impact:** -4 points

3. **No Multi-Window Handling (P2)**
   - If multiple windows open, all receive orchestrator:status events
   - AgentActivityBadge in window 2 shows run from window 1
   - **Better:** Filter events by workspaceId
   - **Score Impact:** -2 points

4. **Missing initOrchestratorIPC Call Site (P1)**
   - Plan shows the listener setup exists
   - But doesn't say WHERE to call initOrchestratorIPC()
   - Is it called? When? In App.tsx useEffect?
   - **Score Impact:** -2 points

**Recommendations:**
1. Add OrchestratorStatusUpdate import to preload
2. Verify exact channel name (grep main and store)
3. Add workspaceId filtering to events
4. Specify where initOrchestratorIPC() is called

---

## Pass 1 Summary

### Scores
| Persona | Score | Key Issue |
|---------|-------|-----------|
| Steve (Hardening) | 78/100 | Fix 2 not verified (guesswork) |
| Quinn (QA) | 81/100 | No tests for new components |
| Chen (Architect) | 83/100 | Duplicate BFS logic |
| Jake (UX) | 85/100 | Context indicator too verbose |
| Sage (UX Eval) | 82/100 | Doesn't match mental model |
| Morgan (Product) | 79/100 | No spec coverage validation |
| Sam (Integration) | 87/100 ⭐ | Type import missing in preload |

**Average: 82.1/100**
**Target: 95+**
**Gap: -12.9 points**

### Priority Issues to Fix (P0/P1)

**P0 (Blocking):**
1. Fix 2 root cause is NOT verified - need actual debugging
2. Channel name mismatch could break IPC wiring
3. ContextIndicator BFS logic is TODO comment

**P1 (Ship Blockers):**
4. No tests for 3 new components
5. Missing type imports in preload
6. Context indicator too verbose (UX regression)
7. No spec coverage validation

### Recommended Fixes for v1.1

**Fix 1: Debug Fix 2 Properly**
- Actually trace the depth bug with debugger or console.logs
- Verify exact root cause before proposing fix
- Update plan with proven fix, not hypothesis

**Fix 2: Implement ContextIndicator BFS**
- Don't duplicate BFS - parse getContextForNode() output
- Extract node titles from markdown sections
- Or create helper: getContextSources(nodeId) that returns structured data

**Fix 3: Add Component Tests**
- ContextIndicator.test.tsx - shows correct sources
- AgentActivityBadge.test.tsx - shows correct status
- BridgeStatusBar.test.tsx - sums tokens correctly

**Fix 4: Make Context UI Compact**
- Default: "📎 3 contexts" badge
- Click to expand: show full list
- Keeps ChatPanel clean

**Fix 5: Verify IPC Channel Names**
- Grep main, preload, store
- Ensure all 3 use same channel name
- Document the contract

**Fix 6: Add Type Imports**
- Import OrchestratorStatusUpdate in preload
- Verify all types are exported from @shared/types

**Fix 7: Add Spec Cross-Reference**
- Which spec does each fix address?
- Are we meeting spec promises?
- Document spec → fix mapping

---

## Confidence Projection After v1.1

**Estimated scores after applying 7 fixes:**
- Steve: 78 → 88 (+10)
- Quinn: 81 → 91 (+10)
- Chen: 83 → 90 (+7)
- Jake: 85 → 92 (+7)
- Sage: 82 → 88 (+6)
- Morgan: 79 → 90 (+11)
- Sam: 87 → 94 (+7)

**Projected Average: 90.4/100**
**Still need:** +4.6 points to hit 95%

**Additional fixes for v1.2 (to reach 95%):**
- Add error boundaries
- Add performance optimization
- Add completion feedback
- Add context depth visualization

---

**End of Pass 1**
**Recommendation:** Apply 7 critical fixes → create v1.1 → Re-evaluate
