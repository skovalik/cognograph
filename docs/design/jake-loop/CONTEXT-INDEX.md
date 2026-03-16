# Context Index — Jake's External Brain

## Files Read

| File | Read At | Key Insights |
|------|---------|--------------|
| styleguide-master_02.html (lines 1-500) | M1 | Tokens complete, dark/light themes, node colors defined |
| styleguide-master_02.html (lines 500-1000) | M1 | GUI classes defined (.gui-btn, .gui-panel, .gui-toggle, etc.), animations, composed demo helpers |
| stefan-brand-identity.md | Pre-loop | ADHD+Autism, initiation difficulty, need for completion, bouncer principle |
| jake-ux-principal.md | Pre-loop | Figma/Miro/Notion background, "Scan, Act, Dive" philosophy |
| VISION.md | Pre-loop | "Google Wave meets Figma for AI", context injection is killer feature |
| NORTH_STAR.md | Pre-loop | 3D desktop vision, spatial organization, depth = focus |
| ui_refactoring_plan.md | Pre-loop | 8-phase plan to standardize to tokens, in-progress |
| visual-feedback-juiciness.md | Pre-loop | Streaming, warmth, particles, context flow — spec exists, not implemented |
| styleguide_plan_02.md | Pre-loop | K-P composed sections planned |
| TOKENS.md | Pre-loop | Full token reference |
| components.md | Pre-loop | Component inventory, nomenclature |

## Files To Read (Queued)

- [ ] ConversationNode.tsx — verify streaming implementation
- [ ] workspaceStore.ts — state architecture, persistence
- [ ] ChatPanel.tsx — core interaction patterns
- [ ] App.tsx — layout structure, z-index layers
- [ ] LeftSidebar.tsx — layers panel, tree structure
- [ ] PropertiesPanel.tsx — property editing UX
- [ ] Toolbar.tsx — responsive behavior

## Key Assumptions

1. styleguide-master_02.html = target design (may need adjustments)
2. Implementation lags behind styleguide in many areas
3. Stefan uses this tool daily — real usage informs priorities
4. Spatial CLI vision is the ultimate success metric

## Implementation Gap Tracker

| Styleguide Feature | Implemented? | Evidence | Priority |
|--------------------|--------------|----------|----------|
| Streaming glow animation | ? | Need to check ConversationNode.tsx | P1 |
| Warmth indicators | ? | Need to check store + nodes | P1 |
| Token-based panel styling | Partial | ui_refactoring_plan.md says in-progress | P1 |
| Interactive states (hover/focus) | Partial | Styleguide has .gui-btn states | P1 |
| K-P composed sections | Scaffolding only | Styleguide has helpers, no content | P2 |
| Context flow edge animation | ? | Need to check CustomEdge.tsx | P1 |
| Node spawn animation | ? | Need to check | P2 |
| Reduced motion support | ✅ | In styleguide CSS | P1 |

---

*Last updated: Meta-loop start*
