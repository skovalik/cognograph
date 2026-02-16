# Opus 4.6 Review Request - Power-User Evaluation Framework

**Task:** Review and critique the Tier 2 AI Vision testing framework for a professional node-based AI workflow tool.

---

## Context

**Product:** Cognograph - Spatial canvas for AI workflow orchestration
**Target Users:** Power users familiar with n8n, Obsidian, VS Code, Blender nodes, etc.
**Problem:** Initial UX evaluation used consumer lens and scored 3.0/10, flagging professional features as "too complex"

---

## What Went Wrong (v1 Evaluation)

**Consumer Lens Feedback:**
- ❌ "Too many buttons" (expected all controls visible for power tool)
- ❌ "Context Injection is confusing" (standard term in AI workflows)
- ❌ "Why do I need to know about graph depth?" (core feature for experts)
- ❌ Result: 3.0/10 clarity

**Reality:** This is like evaluating Blender or VS Code and saying "too many options, simplify!"

---

## What We Created (v2 Framework)

**Files to Review:**

1. **`e2e/smart-e2e/tier2/evaluation-framework-v2.md`**
   - 4 power-user personas (n8n builder, Obsidian expert, AI engineer, consultant)
   - 10 power-user scenarios (workflow setup, debugging, bulk operations)
   - Professional tool criteria (discoverability, efficiency, information density)

2. **`e2e/smart-e2e/tier2/power-user-evaluation.spec.ts`**
   - Test implementation with 6 realistic scenarios
   - Proper node creation (Conversation nodes for chat tests)

3. **`e2e/smart-e2e/utils/ai-vision-evaluator.ts`** (new methods)
   - `powerUserFirstImpression()` - Assumes domain expertise
   - `powerUserTaskCompletion()` - Evaluates efficiency, not simplicity
   - `powerUserFeatureLocation()` - Tests discoverability for experts

---

## Your Job (Opus 4.6)

### **1. Review Personas (Are they realistic?)**
- Marcus (n8n workflow builder)
- Sarah (Obsidian power user, 5000+ notes)
- Jake (AI automation engineer)
- Ravi (strategy consultant, uses Miro + Notion)

**Questions:**
- Are these the right archetypes for this tool?
- Missing any critical user types?
- Are their expectations realistic?
- Are their dealbreakers accurate?

---

### **2. Critique Evaluation Criteria**

**Current criteria:**
- Discoverability (30%): Can I find features?
- Learnability (25%): Once found, do I understand it?
- Efficiency (25%): Can I work fast?
- Information Density (20%): Is the right info visible?

**Questions:**
- Are these the right criteria for professional tools?
- Are the weights correct?
- Missing any critical dimensions?
- Are the scoring rubrics calibrated correctly?

---

### **3. Improve AI Prompts**

**Current approach:**
- System prompt assumes domain expertise
- User prompt asks for power-user perspective
- Scoring focuses on discoverability, not simplicity

**Questions:**
- Do the prompts successfully shift from consumer to expert lens?
- Are there biases still present?
- How can we improve signal quality?
- Should we use different temperatures or models?

---

### **4. Validate Test Scenarios**

**Example scenario:**
```
"Set up a 3-node workflow where a research note provides context
to an AI conversation that outputs to a task list"
```

**Questions:**
- Are these realistic power-user tasks?
- Do they test the right capabilities?
- Missing any critical workflows?
- Are the expected behaviors accurate?

---

### **5. Identify Gaps or Risks**

**Potential issues:**
- Are we overcorrecting from consumer → expert lens?
- Might we miss real usability issues by being too forgiving?
- Are the personas too narrow?
- Should we test multiple expertise levels (novice power-user vs expert)?

---

## Expected Outcome

**Your output should be:**

1. **Critique** of the framework (what's wrong, what's missing)
2. **Specific edits** to prompts, personas, or scenarios
3. **Recommendation** on whether to proceed or iterate
4. **Expected score range** for a well-designed power tool (is 7.5/10 the right target?)

---

## Files to Read

Please read these 3 files in order:

1. `e2e/smart-e2e/tier2/evaluation-framework-v2.md` (full framework)
2. `e2e/smart-e2e/tier2/power-user-evaluation.spec.ts` (test implementation)
3. `e2e/smart-e2e/utils/ai-vision-evaluator.ts` (scroll to bottom for new methods)

Then provide your critique and edits.

---

## Context Files (Optional Background)

If you want full context:
- `docs/plans/smart-e2e-cognitive-testing-system.md` (original plan)
- `docs/strategy/VISION.md` (product vision - "Factorio for LLMs")
- `ARCHITECTURE.md` (technical overview)

---

**Your critique will determine whether we proceed with testing or iterate on the framework.**
