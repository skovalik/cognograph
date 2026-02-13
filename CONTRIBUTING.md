# Contributing to Cognograph

Thank you for your interest in contributing to Cognograph! This guide will help you get started.

---

## Quick Start

### Prerequisites
- Node.js 20+
- npm 9+
- Git

### Setup

```bash
git clone https://github.com/AurochsDigital/cognograph.git
cd cognograph
npm install
npm run dev
```

The app will launch. On first run, you'll need to add an API key (Settings → Connectors).

---

## Project Structure

```
src/
├── main/           # Electron main process
│   ├── workspace.ts        # File I/O, workspace management
│   ├── llm.ts             # LLM provider integrations
│   ├── agent/             # Agent tools, filesystem access
│   └── mcp/               # MCP server implementation
├── preload/        # IPC bridge (window.api)
├── renderer/       # React application
│   ├── components/        # UI components
│   ├── stores/           # Zustand state (18+ stores)
│   ├── services/         # Agent tools, extraction, AI
│   └── utils/            # Helpers, context building
└── shared/         # Types shared across processes
```

---

## Development Workflow

### Branch Naming

- `feature/feature-name` — New features
- `fix/bug-name` — Bug fixes
- `docs/doc-name` — Documentation only
- `refactor/refactor-name` — Code refactoring
- `test/test-name` — Test additions

### Commit Format

```
type: Brief description (50 chars)

Detailed explanation of what changed and why.
- Bullet points for multiple changes
- Include file names when relevant

Co-Authored-By: Your Name <email@example.com>
```

**Types:** `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`

---

## Code Style

### TypeScript

- **Strict mode enabled** — No `any` types (use `unknown` + type guards)
- **Explicit return types** on all functions
- **No optional chaining abuse** — Use proper null checks
- **Discriminated unions** for node types (see `src/shared/types/nodes.ts`)

### React

- **Wrap custom nodes in `memo()`** — Prevents unnecessary re-renders
- **Use Zustand selectors** — Not entire store (`useNodes()` not `useWorkspaceStore()`)
- **No `useState` for shared state** — Use Zustand stores
- **Cleanup in `useEffect`** — Always return cleanup function

### State Management

- **Zustand stores** in `src/renderer/src/stores/`
- **Immer for mutations** — All stores use immer middleware
- **Custom hooks for selectors** — Export `useNodes()`, `useEdges()`, etc.
- **No prop drilling** — Use stores, not props, for global state

---

## Testing

### Running Tests

```bash
npm test              # Run all tests
npm test -- --watch   # Watch mode
npm test -- --coverage  # With coverage report
npm test -- MyComponent  # Specific file
```

### Writing Tests

**Location:** Co-locate with source (`__tests__/` folders)

**Pattern:**
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MyComponent } from '../MyComponent'

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Expected text')).toBeInTheDocument()
  })
})
```

**Coverage target:** 50%+ for new code

---

## Key Patterns

### Creating a New Node Type

See `docs/wiki/components/node-component-guide.md` (coming soon) or study `TextNode.tsx` (simplest example) and `ConversationNode.tsx` (full-featured).

### IPC Communication

**Never import `electron` in renderer.** Use `window.api`:

```typescript
// ❌ BAD
import { ipcRenderer } from 'electron'

// ✅ GOOD
const result = await window.api.workspace.load(filePath)
```

### Adding to a Store

```typescript
// Use immer for mutations
const myStore = create<State>()(
  immer((set, get) => ({
    items: [],
    addItem: (item) => set((state) => {
      state.items.push(item) // Immer handles immutability
    })
  }))
)
```

---

## Common Pitfalls

See `docs/guides/PITFALLS.md` for detailed explanations. Quick list:

- **React Flow referential equality** — Always create new node/edge objects
- **Re-render loops** — Use memo(), useCallback(), useMemo()
- **IPC error handling** — Always wrap in try/catch
- **Type assertions** — Avoid `as any`, use type guards
- **Store subscriptions** — Unsubscribe in useEffect cleanup

---

## Pull Request Checklist

Before submitting:

- [ ] Tests added for new functionality
- [ ] All tests passing (`npm test`)
- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] Code follows style guide
- [ ] Commit messages follow format
- [ ] Documentation updated (if needed)
- [ ] No new `any` types introduced
- [ ] Components use memo() where appropriate

---

## Need Help?

- **Documentation:** Start with `CLAUDE.md` (routes to all docs)
- **Architecture:** See `ARCHITECTURE.md`
- **Common issues:** See `docs/guides/PITFALLS.md`
- **Decisions:** See `DECISIONS.md` for rationale on key choices
- **Questions:** Open a GitHub issue or discussion

---

## Project Values

1. **Build for Stefan First** — If it doesn't solve Stefan's problems, it doesn't ship
2. **Working Software Over Plans** — Ship small and functional vs. plan big and theoretical
3. **Spatial Thinking as First-Class** — Every feature respects the spatial metaphor
4. **Progressive Disclosure** — Simple by default, powerful when needed

---

Thanks for contributing! Every PR makes Cognograph better for people who think spatially.
