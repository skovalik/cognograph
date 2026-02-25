# Node Type Change - Mismatched Handles Fix

## Status: ✅ FIXED

**Fixed in:** `src/renderer/src/components/PropertiesPanel.tsx`
**Date:** 2026-02-02

## Problem

When changing a node's type via the Properties Panel UI (e.g., Note → Task), the handles become visually mismatched with the card. This happens because:

1. `changeNodeType()` updates `node.type` and `node.data` in the store
2. React Flow renders the new component (e.g., TaskNode instead of NoteNode)
3. **But React Flow doesn't recalculate handle positions** because `updateNodeInternals()` is never called after the type change

## Root Cause

**File:** `src/renderer/src/components/PropertiesPanel.tsx:103-110`

```typescript
const handleTypeChange = useCallback(
  (newType: NodeData['type']) => {
    if (targetNodeId && selectedNode && newType !== selectedNode.data.type) {
      changeNodeType(targetNodeId, newType)
      // ← Missing: updateNodeInternals(targetNodeId) not called!
    }
  },
  [targetNodeId, selectedNode, changeNodeType]
)
```

When a node's type changes, React Flow needs to be explicitly told to recalculate the node's internal layout (including handle positions) via `updateNodeInternals()`.

## Solution

Call `updateNodeInternals()` after changing a node's type. There are two approaches:

### Option A: Fix in PropertiesPanel (Recommended)

Add `updateNodeInternals` call after `changeNodeType` in the component where the type change is triggered.

**File:** `src/renderer/src/components/PropertiesPanel.tsx`

```typescript
// Add import
import { useReactFlow } from '@xyflow/react'

// In component body
const { updateNodeInternals } = useReactFlow()

// Updated handler
const handleTypeChange = useCallback(
  (newType: NodeData['type']) => {
    if (targetNodeId && selectedNode && newType !== selectedNode.data.type) {
      changeNodeType(targetNodeId, newType)
      // Force React Flow to recalculate handle positions
      requestAnimationFrame(() => {
        updateNodeInternals(targetNodeId)
      })
    }
  },
  [targetNodeId, selectedNode, changeNodeType, updateNodeInternals]
)
```

Note: `requestAnimationFrame` ensures the DOM has updated before recalculating.

### Option B: Fix in Store (Alternative)

Make `changeNodeType` emit an event that triggers `updateNodeInternals` at the React Flow level. This is more complex and would require adding an event/callback system.

## Files to Modify

| File | Change |
|------|--------|
| `src/renderer/src/components/PropertiesPanel.tsx` | Add `useReactFlow` hook, call `updateNodeInternals` after type change |

## Implementation Steps

1. Import `useReactFlow` from `@xyflow/react` in PropertiesPanel.tsx
2. Destructure `updateNodeInternals` from the hook
3. Add `updateNodeInternals(targetNodeId)` call in `handleTypeChange` after `changeNodeType`
4. Wrap in `requestAnimationFrame` to ensure DOM is ready
5. Add `updateNodeInternals` to the callback dependency array

## Verification

1. Create a Note node
2. Select it and open Properties Panel
3. Change type to Task using the type dropdown
4. **Verify:** Handles should be correctly positioned around the card (not floating or offset)
5. Change type back to Note
6. **Verify:** Handles should remain correctly positioned
7. Test with multiple node types: Note ↔ Task ↔ Conversation ↔ Artifact
8. **Verify:** All type changes result in properly positioned handles

## Additional Checks

- [ ] Ensure undo/redo still works correctly after this change
- [ ] Test that edges remain connected after type change
- [ ] Verify no console errors during type change

## Implementation Applied

The fix was applied exactly as described in Option A:

1. ✅ Added `import { useReactFlow } from '@xyflow/react'` at line 3
2. ✅ Added `const { updateNodeInternals } = useReactFlow()` in component body at line 57
3. ✅ Updated `handleTypeChange` callback (lines 105-116) to call `updateNodeInternals(targetNodeId)` wrapped in `requestAnimationFrame`
4. ✅ Added `updateNodeInternals` to the dependency array
5. ✅ TypeScript compiles without errors
