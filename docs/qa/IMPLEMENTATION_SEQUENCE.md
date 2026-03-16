# QA-Reviewed Implementation Sequence

> This is the QA-validated fix plan for all 26 audit issues. Each fix has been analyzed for dependencies, regression risks, specification gaps, and testing requirements.

**Total estimated time:** 9-11 hours (revised up from audit's 8.5h estimate)
**Critical path:** Phase 2 (AI Editor) — must be sequential, ~3-4 hours

---

## Pre-Implementation Decisions Required

Before starting, these 5 specification gaps need decisions:

### Decision 1: How to pass requestId for streaming (Issue 2)
- **Option A (Recommended):** Add `requestId` as a property of `AIEditorContext` in `src/shared/types.ts`. Generate in `aiEditorStore.ts:230`, extract in `aiEditor.ts:873`.
- **Option B:** Separate parameter to `generatePlanStreaming()` — cleaner IPC but more changes.

### Decision 2: InlinePrompt plan application UX (Issue 3)
- **Option A (Recommended):** Add Apply/Cancel buttons when streaming completes. Matches AIEditorModal pattern.
- **Option B:** Auto-apply. Risky for large plans — user has no review step.
- **Option C:** Transition to AIEditorModal. Extra complexity, but full preview UI.

### Decision 3: AbortController Map key strategy (Issue 5)
- **Option A (Recommended):** Key by `conversationId`. One stream per conversation. Simpler cancellation.
- **Option B:** Key by `requestId`. Allows multiple streams per conversation but more complex.

### Decision 4: Gemini cancel mechanism (Issue 6)
- **Finding:** Google Generative AI SDK does NOT support AbortSignal natively.
- **Approach:** Best-effort loop break with abort flag. Stream continues server-side (can't prevent token usage).

### Decision 5: Empty message identification (Issue 9)
- **Option A (Recommended):** Add `isPlaceholder: boolean` flag to the message when creating the empty assistant message. Remove only messages with this flag on cancel.
- **Option B:** Track placeholder by array index. Simpler but brittle with rapid messages.

---

## Implementation Phases

### Phase 1: Quick Wins — No Dependencies, Minimal Risk
**Time: ~1 hour | Risk: Minimal | Impact: High**

Do these first to build momentum and deliver immediate value.

#### 1.1 Issue 17: Remove API Key Logging (5 min)
**File:** `src/main/llm.ts:30-75`
**Action:** Delete or gate behind `DEBUG_LLM` env var the 12 console.log statements.
**Regression risk:** Zero. Only removes logging.
**Test:** Run app, open dev tools, verify no key info in console.

#### 1.2 Issue 14: Hidden Node Types Serialization (15 min)
**Files:** `src/renderer/src/stores/workspaceStore.ts`
**Action:**
- In `getWorkspaceData()` (~line 3196): Add `hiddenNodeTypes: Array.from(state.hiddenNodeTypes)`
- In `loadWorkspace()`: Add `state.hiddenNodeTypes = new Set(data.hiddenNodeTypes || [])`
- In `newWorkspace()`: Ensure `state.hiddenNodeTypes = new Set()`
**Regression risk:** Low. Old workspaces without this field handled by `|| []` fallback.
**Test:** Hide node types → save → reload → verify hidden state persists. Load old workspace → verify no crash.

#### 1.3 Issue 19: createdAt Overwrite (20 min)
**Files:** `src/renderer/src/stores/workspaceStore.ts`
**Action:**
- Add `createdAt: number | null` to workspace state (near line 111)
- Initialize in `createNewWorkspace()`: `createdAt: Date.now()`
- In `loadWorkspace()`: `state.createdAt = data.createdAt || data.updatedAt || Date.now()`
- In `getWorkspaceData()` line 3196: Change to `createdAt: state.createdAt || Date.now()`
**Regression risk:** Low. Old workspaces fall back gracefully.
**Test:** Create workspace → save → reload → verify createdAt unchanged.

#### 1.4 Issue 1: Keyboard Shortcuts (15 min)
**File:** `src/renderer/src/App.tsx:1370-1438`
**Action:** Move the `if (e.shiftKey && !isInputFocused)` block OUTSIDE the `if (e.ctrlKey || e.metaKey)` block.

**CRITICAL GUARD** (from regression analysis):
```typescript
// MUST add !e.ctrlKey && !e.metaKey to prevent Shift+A colliding with Ctrl+A:
if (e.shiftKey && !e.ctrlKey && !e.metaKey && !isInputFocused) {
  // Prevent browser defaults (Shift+N = new window, Shift+T = reopen tab)
  if (['N', 'C', 'T', 'P', 'A', 'W', 'X', 'Z'].includes(e.key.toUpperCase())) {
    e.preventDefault()
  }
  // ...node creation shortcuts...
}
```

**Then update labels in:**
- `src/renderer/src/components/Toolbar.tsx:269-324` — Change "Ctrl+Shift+X" to "Shift+X" for all 6 tooltips
- `src/renderer/src/components/EmptyCanvasHint.tsx:117-121` — Update hint text
- Keyboard Shortcuts Help panel

**Regression risk:** Medium. Must include `!e.ctrlKey && !e.metaKey` guard or Ctrl+Shift+C (copy) breaks.
**Test:** Press Shift+C (creates conversation), Ctrl+A (select all still works), type in modal with Shift held.

---

### Phase 2: AI Editor Critical Path — Sequential, Issue 2 Blocks 3 & 4
**Time: ~3-4 hours | Risk: Medium | Impact: CRITICAL**

```
Issue 2 (requestId) ──MUST COMPLETE──→ Issue 4 (AISidebar) ──→ Issue 3 (InlinePrompt)
```

#### 2.1 Issue 2: AI Editor requestId Mismatch (2-2.5 hours)
**Files:** `src/preload/index.ts`, `src/main/aiEditor.ts`, `src/renderer/src/stores/aiEditorStore.ts`, `src/shared/types.ts`

**Action (4 layers):**
1. Add `requestId?: string` to `StreamChunkPayload`, `StreamPhasePayload`, `StreamCompletePayload`, `StreamErrorPayload` in `preload/index.ts:165-187`
2. Add `requestId?: string` to `AIEditorContext` in `src/shared/types.ts`
3. In `aiEditorStore.ts:230`: Set `context.requestId = requestId` before calling `api.generatePlanStreaming(context)`
4. In `aiEditor.ts`: Extract `context.requestId` in `generatePlanWithStreaming()` and pass to all `emitStreamChunk`, `emitStreamPhase`, `emitStreamComplete`, `emitStreamError` calls

**Regression risks (from QA):**
- Make requestId **optional** (not required) to avoid breaking non-streaming paths
- Add console.warn if chunk arrives without requestId (catches integration errors)
- Test all 4 event types: chunk, phase, complete, error
- Test concurrent requests (modal + sidebar simultaneously)

**Test checklist:**
- [ ] Open AIEditorModal (Ctrl+E), generate plan, verify `currentPlan` populates
- [ ] Open AISidebar (Ctrl+Shift+A), generate plan, verify plan appears
- [ ] Open InlinePrompt (/), generate plan, verify streaming preview works
- [ ] Cancel mid-stream, verify clean cancellation
- [ ] Generate 2 plans quickly, verify second doesn't get first's events

#### 2.2 Issue 4: AISidebar "Apply" Button (15 min)
**File:** `src/renderer/src/components/ai-editor/AISidebar.tsx`
**Depends on:** Issue 2 (need currentPlan to exist)

**Action:**
1. Import `executeMutationPlan` from `'../../utils/mutationExecutor'`
2. Add applied-plan tracking state to prevent double-apply:
```typescript
const [appliedPlanIds, setAppliedPlanIds] = useState<Set<string>>(new Set())
```
3. Create `handleApply` callback (copy pattern from AIEditorModal:209-212):
```typescript
const handleApply = useCallback(async () => {
  if (!currentPlan || appliedPlanIds.has(currentPlan.id)) return
  await executeMutationPlan(currentPlan)
  setAppliedPlanIds(prev => new Set(prev).add(currentPlan.id))
}, [currentPlan, appliedPlanIds])
```
4. Wire `onClick={handleApply}` on button at line 269

**Regression risk (from QA):** Double-apply creates duplicate nodes. The `appliedPlanIds` Set prevents this.
**Test:** Generate plan → Apply → verify nodes appear → click Apply again → verify no duplicates.

#### 2.3 Issue 3: InlinePrompt Plan Application (1.5-2 hours)
**File:** `src/renderer/src/components/ai-editor/InlinePrompt/index.tsx`
**Depends on:** Issue 2

**Action:**
1. Import `executeMutationPlan` and `useAIEditorStore`
2. Add Apply/Cancel buttons to StreamingPreview when `streamingPhase === 'complete'`
3. Wire `executeMutationPlan(currentPlan)` to Apply button
4. Add double-apply guard (same pattern as Issue 4)
5. Close InlinePrompt after successful application

**Regression risk:** Low — only adds new functionality.
**Test:** Press `/` → type prompt → wait for plan → click Apply → verify nodes appear on canvas.

---

### Phase 3: LLM Streaming Robustness — Issue 5 before 6 and 7
**Time: ~3-4 hours | Risk: Medium | Impact: Medium**

```
Issue 5 (AbortController Map) ──→ Issue 6 (Gemini cancel) ──→ Issue 9 (empty messages)
```

#### 3.1 Issue 5: AbortController Race Condition (1.5-2 hours)
**Files:** `src/main/llm.ts`, `src/preload/index.ts`

**Action:**
1. Replace `let abortController` with `const activeStreams = new Map<string, AbortController>()`
2. Update `streamAnthropic()`, `streamOpenAI()`, `streamGemini()` to create and store per-conversation controllers
3. **BREAKING CHANGE:** Update `llm:cancel` handler to accept `conversationId` parameter:
```typescript
ipcMain.handle('llm:cancel', async (_event, conversationId: string) => {
  const controller = activeStreams.get(conversationId)
  if (controller) {
    controller.abort()
    activeStreams.delete(conversationId)
  }
})
```
4. Update preload type: `cancel: (conversationId: string) => Promise<void>`
5. Update ChatPanel.tsx cancel call: `await window.api.llm.cancel(nodeId)`
6. Add cleanup in stream completion handlers (delete from Map on complete/error)

**Regression risk (from QA):** MEDIUM — Breaking API change. Must update preload types AND renderer calls together.
**Test:**
- [ ] Open 2 conversations, stream in both, cancel one — verify other continues
- [ ] Start stream, close chat window — verify stream aborts
- [ ] Send message after cancelling — verify new stream works

#### 3.2 Issue 6: Gemini Cancel Support (30-60 min)
**File:** `src/main/llm.ts:120-163`
**Depends on:** Issue 5 (uses the Map)

**Action:** (Best-effort — SDK doesn't support AbortSignal)
1. Get controller from `activeStreams` Map
2. In the `for await` loop, check `controller.signal.aborted` each iteration
3. If aborted, break loop and send error event (not complete):
```typescript
for await (const chunk of result.stream) {
  if (activeStreams.get(conversationId)?.signal.aborted) {
    mainWindow.webContents.send('llm:error', {
      conversationId, error: 'Cancelled by user'
    })
    return // Don't send complete
  }
  // ...process chunk...
}
```

**Regression risk:** Low. Stream continues server-side (can't prevent), but client stops processing.
**Test:** Start Gemini chat → cancel → verify no more chunks arrive in UI.

#### 3.3 Issue 9: Cancelled Stream Empty Messages (30 min)
**Files:** `src/main/llm.ts`, `src/renderer/src/components/ChatPanel.tsx`
**Depends on:** Issues 5 & 6 (cancel infrastructure)

**Action:**
1. In `llm.ts` abort handler: Send `{ conversationId, response: '', cancelled: true }`
2. In `ChatPanel.tsx` placeholder creation: Add `isPlaceholder: true` flag:
```typescript
addMessage(nodeId, 'assistant', '', { isPlaceholder: true })
```
3. In `ChatPanel.tsx` onComplete handler:
```typescript
if (data.cancelled || data.response === '') {
  const messages = nodeData.messages
  const lastMsg = messages[messages.length - 1]
  if (lastMsg?.role === 'assistant' && lastMsg.isPlaceholder) {
    // Remove the placeholder
    removeLastMessage(nodeId)
  }
}
```
4. Add `removeLastMessage(nodeId: string)` action to workspaceStore (simple splice of last message)

**Regression risk (from QA):** Must only remove messages with `isPlaceholder` flag, not real empty messages.
**Test:** Send message → cancel immediately → verify no ghost message. Send message → cancel after chunks → verify partial content handled.

---

### Phase 4: Action Node + Remaining Fixes — Independent
**Time: ~2 hours | Risk: Low | Impact: Low-Medium**

#### 4.1 Issue 8: Action Node Condition Evaluation (45-60 min)
**Files:** `src/renderer/src/stores/actionStore.ts`, `src/shared/actionTypes.ts`
**Action:**
1. Add `actionNodeId?: string` to `ActionEvent` in `actionTypes.ts`
2. Add `actionNodeId` parameter to `evaluateConditions()` at line 326
3. Pass from call site at line 138 (trace through executeAction to find the action node ID)
4. In the `case 'action-node':` branch, use the parameter instead of `event.data?.actionNodeId`

**Regression risk:** Low. Only fixes broken path.
**Test:** Create Action node with condition targeting own properties → verify condition evaluates.

#### 4.2 Issue 7: Schedule Triggers (noted but deferred)
Listed as "Quick Win" in roadmap but actually 4+ hours. Consider deferring to Phase 4 of the roadmap unless Action nodes are a priority.

#### 4.3 Issues 15, 16, 20-26: Medium/Low Priority
These can be done in any order, no dependencies:

| Issue | Fix | Time |
|-------|-----|------|
| 15 | Remove or implement template file import menu item | 5 min |
| 16 | Connect AI Property Assist settings button to SettingsModal | 15 min |
| 20 | Add node search to CommandPalette filtered results | 2 hours |
| 21 | Change ChatPanel textarea `rows={2}` to `rows={1}` + auto-expand | 30 min |
| 22 | Make provider/model badge more prominent | 15 min |
| 23 | Implement or remove external-change IPC listener | 30 min |
| 24 | Add `window.api?.attachment` guard in useAttachments | 10 min |
| 25 | Add `webSecurity: true` to BrowserWindow config | 5 min |
| 26 | Add Zod schema validation to workspace JSON.parse | 1-2 hours |

---

## Dependency Graph (Visual)

```
PHASE 1 (parallel, ~1h)          PHASE 2 (sequential, ~3-4h)
┌──────────┐                     ┌──────────────────┐
│ Issue 17 │──┐                  │ Issue 2          │
│ (5 min)  │  │                  │ requestId fix    │
└──────────┘  │                  │ (2-2.5h)         │
┌──────────┐  │                  └────────┬─────────┘
│ Issue 14 │──┤  ALL PARALLEL             │
│ (15 min) │  │                  ┌────────┴─────────┐
└──────────┘  │                  │                   │
┌──────────┐  │            ┌─────▼─────┐    ┌───────▼──────┐
│ Issue 19 │──┤            │ Issue 4   │    │ Issue 3      │
│ (20 min) │  │            │ AISidebar │    │ InlinePrompt │
└──────────┘  │            │ (15 min)  │    │ (1.5-2h)     │
┌──────────┐  │            └───────────┘    └──────────────┘
│ Issue 1  │──┘
│ (15 min) │
└──────────┘

PHASE 3 (sequential, ~3-4h)      PHASE 4 (independent, ~2h)
┌──────────────────┐              ┌──────────┐
│ Issue 5          │              │ Issue 8  │
│ AbortController  │              │ (45 min) │
│ (1.5-2h)         │              └──────────┘
└────────┬─────────┘              ┌──────────┐
         │                        │ Issues   │
┌────────┴─────────┐              │ 15-26    │
│                   │              │ (varied) │
┌─────▼──────┐  ┌──▼───────┐     └──────────┘
│ Issue 6    │  │ Issue 9   │
│ Gemini     │  │ Empty msg │
│ (30-60min) │  │ (30 min)  │
└────────────┘  └───────────┘
```

---

## Testing Strategy

### After Each Phase

| Phase | Manual Test | Pass Criteria |
|-------|------------|---------------|
| Phase 1 | Press Shift+C, Shift+N, Shift+T. Toggle hidden node types, save, reload. Check console for API key logs. | Shortcuts work. Hidden types persist. No key logging. |
| Phase 2 | Open all 3 AI Editor entry points. Generate plan in each. Click Apply. | Plans generate, preview, AND apply in all 3 entry points. |
| Phase 3 | Open 2 chats. Stream in both. Cancel one. Cancel with Gemini. | Correct stream cancelled. No ghost messages. Other stream continues. |
| Phase 4 | Create Action node with self-targeting condition. Fire it. | Condition evaluates correctly. |

### Integration Smoke Test (After All Phases)

Run through Workflow 1 (Contextual Research Branching) from the POST_AUDIT_ROADMAP.md:
1. Create 2 Notes + 1 Conversation via keyboard shortcuts
2. Connect Notes → Conversation
3. Chat — verify context injection works
4. Use AI Editor to generate related notes
5. Apply the plan — verify nodes appear
6. Cancel a stream — verify clean cleanup

If this workflow works end-to-end, the core experience is functional.

---

## Risk Summary

| Fix | Regression Risk | Key Mitigation |
|-----|----------------|----------------|
| Issue 1 (shortcuts) | Shift+A vs Ctrl+A conflict | Add `!e.ctrlKey && !e.metaKey` guard |
| Issue 2 (requestId) | Type safety at IPC boundary | Make requestId optional, add console.warn |
| Issue 3+4 (apply buttons) | Double-apply duplicates nodes | Track applied plan IDs in state |
| Issue 5 (AbortController) | Breaking API change | Update preload types + renderer calls together |
| Issue 6 (Gemini cancel) | SDK limitation | Best-effort loop break, send error not complete |
| Issue 9 (empty messages) | Wrong message removed | Use `isPlaceholder` flag, not position-based |
| Issue 14 (Set serialization) | Old workspace compat | Use `|| []` fallback on load |

---

*Created: 2026-02-06*
*QA methodology: Dependency analysis + regression risk assessment + specification gap identification*
*Companion documents: docs/qa/AUDIT_RESULTS.md, docs/qa/POST_AUDIT_ROADMAP.md*
