# Smart E2E Cognitive Testing System

**Status:** Phase A implementation (Tier 1 + Tier 2)  
**Plan:** `docs/plans/smart-e2e-cognitive-testing-system.md`  
**Bead:** cognograph_02-bku

---

## What This Is

A 7-tier automated QA pipeline using AI vision as a cognitive proxy. Maximizes UX signal from compute when users/testers are unavailable.

**Key Innovation:** Blind screenshot analysis with adversarial prompts to counteract LLM positivity bias.

---

## Directory Structure

```
e2e/smart-e2e/
├── README.md                          # This file
├── fixtures/
│   └── smart-e2e-fixture.ts           # Test fixtures
├── utils/
│   ├── react-flow-stabilizer.ts       # Viewport stabilization
│   ├── screenshot-capture.ts          # Screenshot + metadata
│   ├── dom-state-capture.ts           # Clickable elements for hallucination detection
│   ├── ai-vision-evaluator.ts         # AI vision API calls (Claude)
│   ├── console-monitor.ts             # Error tracking
│   └── workspace-factory.ts           # Test workspace creation
├── tier1/
│   └── critical-paths.spec.ts         # 5 critical path smoke tests
├── tier2/
│   └── blind-cognitive-proxy.spec.ts  # 10 states, Pass A + B, AI vision
├── screenshots/                       # Captured screenshots + metadata
└── results/                          # AI evaluation results
    └── tier2/
        ├── *-pass-a.json             # Zero-context evaluations
        ├── *-pass-b.json             # Task completion + hallucination detection
        └── aggregate-report.json     # Summary metrics
```

---

## Phase A Implementation (Current)

### Tier 1: Critical Paths (5 tests)
- CP1: App launches without errors
- CP2: Create conversation node
- CP3: Send message in conversation
- CP4: Connect two nodes
- CP5: Workspace persists on reload

**Run:**
```bash
npm run test:e2e -- e2e/smart-e2e/tier1/
```

### Tier 2: Blind Cognitive Proxy (10 states)
- **Pass A:** Zero-context first impression (adversarial)
- **Pass B:** Task completion with stuck detection (adversarial)
- **Hallucination Detection:** Verify AI's claimed click targets exist in DOM

**States tested:**
1. Empty canvas
2. Single node
3. Two connected nodes
4. Chat open
5. Toolbar visible
6. Settings open
7. Sidebar open
8. Node selected
9. Multiple nodes (5)
10. Context menu

**Run:**
```bash
npm run test:e2e -- e2e/smart-e2e/tier2/
```

---

## Configuration

### Required Environment Variables

```bash
# .env or .env.local
ANTHROPIC_API_KEY=sk-ant-...
```

### API Costs (Phase A)

| Tier | States | Cost |
|------|--------|------|
| Tier 1 | 5 | ~$0 (no AI calls) |
| Tier 2 | 10 | ~$1.34 |
| **Total** | | **~$1.34** |

---

## Design Principles

1. **Blind evaluation over scripted paths** — AI evaluates what it SEES, not what it KNOWS
2. **Adversarial over cooperative** — "Where would you quit?" not "what would you do?"
3. **Disagreement is signal** — Multiple models diverge = UX ambiguity
4. **Forced-negative framing** — Counteract LLM positivity bias
5. **DOM cross-check everything** — Verify AI claims against actual clickable elements

---

## Success Criteria (Phase A)

| Metric | Target | Gate |
|--------|--------|------|
| Tier 1 pass rate | 100% | GATE 1 |
| Avg clarity score (Tier 2 Pass A) | 7.0+ / 10 | GATE 1 |
| Hallucination rate (Tier 2 Pass B) | <30% | GATE 1 |
| Total cost | <$2.00 | GATE 1 |

**GATE 1:** If all criteria met → proceed to Phase B. If not → fix P0 issues found.

---

## Next Steps

### Phase B (8-12 hours)
- Expand to 20 states
- Add Pass C (visual search) and Pass D (expectation violation)
- Add 2 more personas (Obsidian User, Context-Switching Worker)
- Multi-model disagreement detection (Claude vs GPT-4o)

### Phase C (6-8 hours, optional)
- Tier 3: Multi-model agreement detection
- Tier 4: Persona-constrained sessions
- Tier 5: Multi-pass consensus
- Tier 6: Aggregate scoring + RL iteration

---

## Troubleshooting

### Tests fail to launch app
- Verify `out/main/index.js` exists: `npm run build`
- Check Playwright config: `npx playwright show-report`

### Screenshots are empty/black
- React Flow async rendering — increase `stableFor` in `waitForCanvasStable`
- Check GPU mode: disable in CI with `ELECTRON_DISABLE_GPU=1`

### AI evaluations return invalid JSON
- Check prompt formatting in `ai-vision-evaluator.ts`
- Increase `max_tokens` if response is truncated

### Hallucination rate > 50%
- Verify DOM capture timing (run AFTER screenshot, BEFORE AI eval)
- Check `checkVisibility()` browser support (fallback implemented)

---

## References

- Plan: `docs/plans/smart-e2e-cognitive-testing-system.md`
- RL Validation: 79.75/100 average (Marcus 82, James 87, Ravi 72, Jake 78)
- Bead: cognograph_02-bku (P0, OPEN)
