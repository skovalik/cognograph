# "Make It Just Work" - Master Integration Plan

**Your Vision:** Open Cognograph → Everything works smoothly → No debugging, no wiring, no refactoring

**Current Reality:** Backend features exist and work, but integration layer incomplete → Users hit friction

**Gap:** The 10% that makes 90% feel like 100%

---

## What I've Learned About Your Vision

### The Thread of Continuity (Jan 2025 → Feb 2026)

**Original Vision (VISION.md):**
- "Spatial canvas for AI workflow orchestration"
- "Google Wave meets Figma for AI conversations"
- **Core insight:** "The interface IS the organization"
- Killer feature: Connected nodes → automatic context injection

**Evolution Path:**
1. **v1.0 (Jan 2025):** Basic canvas + 4 node types + context injection
2. **Mega-plan (Feb 2026):** 14 specs, 15 parallel streams, 68 new files
3. **Wiring fixes:** Connected UI to backend
4. **Phase A (this session):** Made invisible features visible

**Your Thought Process (What I See):**
- Build backend infrastructure first (solid foundation)
- Add features in parallel (speed)
- Wire UI layer (make it usable)
- **Problem:** Integration layer deferred → gaps accumulated

**What You're Trying to Accomplish:**
- Spatial thinking as first-class (not just visual, but functional)
- AI as collaborator (knows what you know via graph structure)
- Autonomous agents (orchestration, not just chat)
- Local-first, privacy-respecting
- "Factorio for LLMs" - build AI factories

---

## Current State Assessment (Post-Hardening)

### What Works Excellently ✅

**Core Canvas:**
- ✅ React Flow integration smooth
- ✅ 10 node types render correctly
- ✅ Drag, resize, connect all work
- ✅ Pan/zoom, minimap functional
- ✅ Selection, undo/redo robust

**Context Injection (Patent P1):**
- ✅ BFS traversal works perfectly (validated via tests)
- ✅ Depth limiting correct
- ✅ Edge strength/direction handling
- ✅ **NEW:** ContextIndicator shows what's being used
- ✅ Empty nodes now contribute metadata

**Persistence:**
- ✅ Auto-save every 2s
- ✅ Save/load via IPC
- ✅ Backup system
- ✅ Workspace validation

**AI Integration:**
- ✅ Anthropic SDK streaming
- ✅ Message history
- ✅ Multi-provider support (structure exists)
- ✅ Token counting

### What's Partially Wired ⚠️

**Orchestrator (Patent P2):**
- ✅ Backend: OrchestratorService fully implemented
- ✅ IPC: Events sent and received
- ✅ Store: orchestratorStore tracks runs
- ⚠️ UI: Badge exists but untested
- ❌ Creation: No menu item, must manually change type
- **Status:** 75% - works if you know how to use it

**Agent Mode:**
- ✅ Backend: Agent service + filesystem tools
- ✅ UI: Toggle in ChatPanel
- ⚠️ Discovery: Hidden in header, no onboarding
- ⚠️ Permissions: No clear indication of what agent can do
- **Status:** 85% - works but mysterious

**Extraction System:**
- ✅ Backend: Extraction service works
- ✅ UI: ExtractionPanel exists
- ⚠️ Integration: Auto-extract works, manual review clunky
- ⚠️ Visibility: No indication that extraction happened
- **Status:** 70% - works but friction-full

**Properties System:**
- ✅ Backend: Schema system sophisticated
- ✅ UI: PropertiesPanel shows properties
- ⚠️ UX: 3,191 lines, overwhelming
- ⚠️ Discovery: Custom properties hidden
- **Status:** 80% - works but complex

### What's Missing UI ❌

**Artifacts:**
- ✅ Backend: ArtifactNode type exists
- ✅ Store: spawnArtifactFromLLM works
- ❌ UI: No drag-drop file handler
- ❌ UI: No file picker button
- **Status:** 40% - can create manually, no workflow

**Templates:**
- ✅ Backend: Template store exists
- ✅ Backend: Save/load methods work
- ❌ UI: No template browser
- ❌ UI: No save template button
- **Status:** 30% - backend only

**Module System:**
- ✅ Spec: module-foundations.md (comprehensive)
- ❌ Backend: Not implemented
- ❌ UI: Not implemented
- **Status:** 0% - future feature

**Multiplayer:**
- ✅ Backend: Yjs integration exists
- ⚠️ UI: Presence indicators exist
- ❌ Activation: No way to enable multiplayer
- **Status:** 20% - infrastructure only

---

## The Integration Gaps (Prioritized)

### P0 Gaps (Blocking "Just Works")

**Gap #1: No Node Creation Menu**
- **What's broken:** Users don't know how to create nodes
- **Current:** Must use Shift+C, Shift+N, etc. (undiscoverable)
- **Spec says:** Toolbar has "Add Node" dropdown
- **Fix:** 2-3 hours to add dropdown menu
- **Impact:** HIGH - core workflow

**Gap #2: Orchestrator Creation Flow**
- **What's broken:** Must create generic node, manually change type to orchestrator
- **Current:** 5-step manual process
- **Spec says:** Click add menu → select Orchestrator → configure
- **Fix:** 1 hour (add to menu + default data)
- **Impact:** MEDIUM - advanced feature

**Gap #3: Context Indicator Not Integrated**
- **What's broken:** Component exists but not in ChatPanel
- **Current:** Standalone, not shown to users
- **Spec says:** Should be visible when chatting
- **Fix:** 30 min (add to ChatPanel render)
- **Impact:** HIGH - killer feature visibility

**Gap #4: Orchestrator Status Untested**
- **What's broken:** Badge/StatusBar added but never smoke-tested
- **Current:** Unknown if it actually works
- **Spec says:** Should show running status
- **Fix:** 1 hour manual testing + fixes
- **Impact:** MEDIUM - new feature validation

### P1 Gaps (UX Friction)

**Gap #5: Artifacts No Workflow**
- Manual node creation only
- Should be: Drag file → artifact appears
- **Fix:** 3-4 hours
- **Impact:** MEDIUM - productivity feature

**Gap #6: Templates Invisible**
- Save template button doesn't exist
- Template browser doesn't exist
- **Fix:** 4-6 hours
- **Impact:** LOW - power user feature

**Gap #7: PropertiesPanel Overwhelming**
- 3,191 lines, hard to navigate
- Should be: Tabbed, organized sections
- **Fix:** 8-12 hours (decomposition)
- **Impact:** MEDIUM - daily use

---

## "Just Works" Sprint - Execution Order

### Sprint 1: Wire Existing Features (4-6h) - THIS SESSION

**Goal:** No orphaned components, everything connected

**Tasks:**
1. Integrate ContextIndicator into ChatPanel (30min)
2. Test orchestrator badge + status bar (1h)
3. Fix any orchestrator UI bugs found (1-2h)
4. Add node creation menu (2-3h)
5. Smoke test all 10 node types (1h)

**Outcome:** Core features fully wired and working

### Sprint 2: Spec Alignment (4-6h) - NEXT SESSION

**Goal:** Specs accurately describe reality

**Tasks:**
1. Audit top 30 specs vs implementation (3h)
2. Mark each feature: Complete/Partial/Missing (1h)
3. Update spec status headers (1h)
4. Create FEATURE_STATUS.md master doc (1h)

**Outcome:** No spec-reality mismatch

### Sprint 3: Missing Workflows (6-8h) - WEEK 2

**Goal:** Key workflows end-to-end

**Tasks:**
1. Artifacts drag-drop (3-4h)
2. Template save/load UI (3-4h)

**Outcome:** All Tier 2 features have UI

### Sprint 4: RL Validation (2-3h) - WEEK 2

**Goal:** Validate "it just works"

**Method:**
- 5 personas simulate cold start
- Rate friction points
- Identify top 10 issues
- Fix in priority order

**Outcome:** 95%+ "just works" confidence

---

## Immediate Action: Sprint 1 Execution

Let me execute Sprint 1 now (4-6h estimate):

**Task 1:** Integrate ContextIndicator → ChatPanel
**Task 2:** Test Orchestrator UI
**Task 3:** Add Node Creation Menu
**Task 4:** Smoke Test All Node Types

**This will close the critical integration gaps and make the app actually usable.**

Shall I proceed with Sprint 1 execution?
