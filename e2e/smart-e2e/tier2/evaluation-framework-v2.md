# Tier 2 Evaluation Framework v2 - Power User Lens

**Date:** 2026-02-15
**Replaces:** Consumer-focused evaluation (avg clarity 3.0/10)
**Target Audience:** Professional power users familiar with node graphs and thinking tools

---

## User Model Assumptions

### **Required Background Knowledge:**

Users have experience with:

1. **Node Graph Tools:**
   - n8n (workflow automation)
   - Blender nodes (shader/geometry nodes)
   - Unreal Engine blueprints
   - Node-RED (IoT automation)
   - ComfyUI (AI image generation)
   - TouchDesigner (creative coding)

2. **Thinking/PKM Tools:**
   - Obsidian (linked markdown notes)
   - Roam Research (bidirectional links)
   - Notion (databases and properties)
   - Miro/FigJam (spatial canvases)
   - Heptabase (visual knowledge management)

3. **AI/Automation Tools:**
   - Cursor/Windsurf (AI code editors)
   - Claude.ai Projects (context management)
   - ChatGPT with custom instructions
   - LangChain/LlamaIndex concepts

### **What They Understand Without Explanation:**

- **Nodes & Edges:** Visual units connected by lines to form graphs
- **Context Injection:** Connected data being passed as input
- **Properties/Metadata:** Structured data fields on objects
- **Spatial Organization:** Using 2D space for organization/hierarchy
- **Conditional Logic:** Rules that determine when things activate
- **Role/Type Fields:** Categorization metadata
- **Depth/Hops:** Graph traversal distance

---

## Evaluation Personas (4 Archetypes)

### **Persona 1: Workflow Automation Builder**
**Name:** Marcus (n8n daily user, 3 years)
**Mental Model:** "Nodes execute actions, edges pass data, I build pipelines"
**Expectations:**
- Visual feedback for data flow
- Clear node type distinctions
- Easy to connect and debug
- Metadata visible for troubleshooting
**Dealbreakers:**
- Can't see what data is passing through edges
- Can't tell which nodes are active/inactive
- Hidden functionality (expects all controls visible)

### **Persona 2: Knowledge Worker / PKM Power User**
**Name:** Sarah (Obsidian expert, 5000+ notes)
**Mental Model:** "Notes link to notes, spatial layout = conceptual structure"
**Expectations:**
- Bidirectional links visible
- Properties for organization
- Quick note capture
- Search and filter across graph
**Dealbreakers:**
- Links feel fragile or hidden
- Can't bulk-organize notes
- Slow to create/connect notes

### **Persona 3: AI Automation Engineer**
**Name:** Jake (builds AI workflows, DevOps background)
**Mental Model:** "LLMs need context, I orchestrate multi-agent systems, prompts are code"
**Expectations:**
- Explicit context control (what goes into prompts)
- Conditional logic for complex flows
- Debug visibility (why did AI get this context?)
- Provider/model configuration accessible
**Dealbreakers:**
- Black-box context injection (can't see what AI receives)
- No way to debug prompt assembly
- Hidden API configuration

### **Persona 4: Creative Researcher / Strategy Consultant**
**Name:** Ravi (uses Miro + Notion, builds frameworks)
**Mental Model:** "Space = structure, proximity = relationship, I think by arranging"
**Expectations:**
- Infinite canvas with zoom levels
- Visual hierarchy through position
- Export to presentations/docs
- Templates for common patterns
**Dealbreakers:**
- Canvas feels cramped or constrained
- Can't see big picture (no semantic zoom)
- Forced into linear organization

---

## Evaluation Criteria (Power User Lens)

### **1. Discoverability (30 points)**
*"Can I find the feature I need when I need it?"*

**NOT evaluated:**
- ❌ "Is everything hidden until needed?" (progressive disclosure)
- ❌ "Is the UI minimal?" (simplicity)

**IS evaluated:**
- ✓ Are features labeled clearly?
- ✓ Can I scan the interface and find what I need?
- ✓ Do icons + labels communicate function?
- ✓ Is advanced functionality visible (not buried in menus)?

**Scoring:**
- 9-10: Every feature is findable within 3 seconds of looking
- 7-8: Most features findable, some require exploration
- 5-6: Half of features require guessing or docs
- 3-4: Most features hidden or ambiguous
- 1-2: Can't find basic functionality

### **2. Learnability (25 points)**
*"Once I find a feature, can I understand what it does?"*

**NOT evaluated:**
- ❌ "Does this require zero explanation?" (consumer simplicity)
- ❌ "Is jargon eliminated?" (oversimplification)

**IS evaluated:**
- ✓ Do labels use domain terminology correctly?
- ✓ Are tooltips/help available for complex features?
- ✓ Does the UI show examples or defaults?
- ✓ Can I infer behavior from similar tools?

**Scoring:**
- 9-10: Labels are precise, tooltips explain edge cases
- 7-8: Most features self-explanatory to target audience
- 5-6: Some features require docs or experimentation
- 3-4: Misleading labels or no explanations
- 1-2: Features are cryptic or unexplained

### **3. Efficiency (25 points)**
*"Can I accomplish complex tasks quickly?"*

**NOT evaluated:**
- ❌ "Is the simplest task easy?" (consumer optimization)
- ❌ "Does it minimize clicks?" (general UI heuristic)

**IS evaluated:**
- ✓ Can I perform bulk operations?
- ✓ Are keyboard shortcuts available and visible?
- ✓ Can I see system state without hunting?
- ✓ Does the UI reduce repetitive work?

**Scoring:**
- 9-10: Power-user workflows are optimized, shortcuts everywhere
- 7-8: Common tasks are efficient, some friction
- 5-6: Basic tasks work, but lots of repetition
- 3-4: Inefficient workflows, too much clicking
- 1-2: Every action requires multiple steps

### **4. Information Density (20 points)**
*"Is the right amount of information visible?"*

**NOT evaluated:**
- ❌ "Is it minimal?" (hiding information)
- ❌ "Does it feel spacious?" (whitespace for aesthetics)

**IS evaluated:**
- ✓ Can I see metadata without opening menus?
- ✓ Is status information persistent (not transient tooltips)?
- ✓ Can I compare multiple items at a glance?
- ✓ Is the information hierarchy clear (primary vs secondary)?

**Scoring:**
- 9-10: Dense but organized, all needed info visible
- 7-8: Good balance, minor omissions
- 5-6: Some important info requires clicks
- 3-4: Too sparse (hidden) or too dense (chaotic)
- 1-2: Can't see what I need or overwhelmed

---

## Test Scenarios (Power User Tasks)

### **Scenario 1: Agent Workflow Setup**
**Task:** "Set up a 3-node workflow where a research note provides context to an AI conversation that outputs to a task list"

**Success Criteria:**
- Can create 3 different node types
- Can connect them with edges
- Can see/verify the connections exist
- Can understand which direction data flows

**What We're Testing:**
- Node creation discoverability
- Edge creation mechanics
- Visual feedback for connections
- Data flow clarity

---

### **Scenario 2: Context Debugging**
**Task:** "You're not getting the context you expect in an AI conversation. Figure out which connected notes are being injected and why."

**Success Criteria:**
- Can identify which nodes are connected
- Can see context injection settings
- Can understand activation conditions
- Can modify context rules

**What We're Testing:**
- Context system visibility
- Debugging affordances
- Settings discoverability
- Rule configuration clarity

---

### **Scenario 3: Bulk Organization**
**Task:** "You have 20 nodes. Organize them into 3 projects and add tags/properties for filtering."

**Success Criteria:**
- Can select multiple nodes
- Can bulk-apply properties
- Can create/assign to projects
- Can filter by criteria

**What We're Testing:**
- Bulk operations support
- Property system usability
- Organizational features
- Search/filter capabilities

---

### **Scenario 4: Workflow Template Creation**
**Task:** "You have a working 5-node agent workflow. Save it as a template to reuse for other projects."

**Success Criteria:**
- Can select workflow nodes
- Can save as template
- Can see template in library
- Can instantiate template later

**What We're Testing:**
- Selection mechanics
- Template system discoverability
- Workflow reusability
- Template management

---

### **Scenario 5: API Configuration & Troubleshooting**
**Task:** "Set up Anthropic API key and verify it works by sending a test message."

**Success Criteria:**
- Can find API settings
- Can add API key
- Can create conversation node
- Can verify connection works

**What We're Testing:**
- Settings discoverability
- API configuration flow
- Connection validation
- Error handling visibility

---

### **Scenario 6: Multi-Document Context Assembly**
**Task:** "Connect 5 reference documents to a conversation so the AI has full context about your project."

**Success Criteria:**
- Can import/create 5 document nodes
- Can connect all to conversation
- Can see connection count
- Can verify what's included

**What We're Testing:**
- Multi-connection handling
- Context aggregation visibility
- Large-graph usability
- Context limits/warnings

---

## Updated AI Evaluation Prompts

### **Pass A - First Impression (Power User Context):**

```
You are evaluating professional tooling software, similar to n8n, Obsidian,
or VS Code. The target user is a POWER USER who:

- Uses node-based workflow tools daily (n8n, Blender nodes, ComfyUI)
- Manages 1000+ notes in Obsidian or Roam Research
- Builds AI automation workflows
- Expects information density and visible controls
- Understands jargon like "context injection", "graph traversal", "metadata"

Evaluate this screenshot as someone familiar with these tools would.

Answer in JSON:
{
  "first_impression": "one sentence gut reaction AS A POWER USER",
  "what_it_does": "your best guess in <10 words",
  "familiar_patterns": ["what reminds you of n8n/Obsidian/Figma/etc"],
  "missing_expected_features": ["things power users expect to see but don't"],
  "information_density": "too_sparse/just_right/too_dense",
  "discoverability_score": 0-10,
  "seconds_to_find_core_features": "instant/5sec/15sec/60sec/not_visible",
  "dealbreaker": "what would make a POWER USER quit (or null)"
}
```

---

### **Pass B - Task Completion (Expert User):**

```
You are an experienced n8n workflow builder and Obsidian power user evaluating
a new node-based AI workflow tool. You understand:

- Nodes = units of functionality
- Edges = data/context connections
- Properties = metadata for configuration
- Context injection = passing data to AI prompts

Complete this task using what you see. Assume you're FAMILIAR with node-based
tools and don't need everything explained.

Task: "[specific power-user task]"

Answer in JSON:
{
  "can_complete": true/false,
  "steps": [
    {"action": "what you'd do", "where": "specific UI element", "confidence": "certain/likely/guessing"}
  ],
  "stuck_at_step": null or number,
  "why_stuck": "what's actually missing (not 'what is this' but 'where is the X button')",
  "compared_to_similar_tools": "how does this compare to n8n/Obsidian/etc",
  "efficiency_rating": 0-10
}
```

---

### **Pass C - Information Scent (Expert Scan):**

```
You're an expert user scanning this interface looking for a specific feature.
You know what you want, you just need to find WHERE it is.

You have 5 seconds to find: "[specific feature]"

Answer in JSON:
{
  "found_it": true/false,
  "time_to_find": "instant/<3sec/<10sec/<30sec/gave_up",
  "where_you_looked": ["sequence of places you scanned"],
  "what_helped": "labels/icons/position/color that led you to it",
  "what_hurt": "things that slowed you down or created false positives",
  "compared_to": "how does this compare to where similar tools put this feature"
}
```

---

## Test States (Power User Scenarios)

### **State 1: Fresh Workspace (Power User Perspective)**
**Setup:** Empty canvas after dismissing onboarding
**Task:** "Set up your first agent workflow with context injection"
**Expected:** User knows to create Conversation + Note nodes and connect them

### **State 2: Active Workflow**
**Setup:** Conversation node with 2 connected reference notes, chat open
**Task:** "Verify which notes are being sent as context to the AI"
**Expected:** User looks for context indicators, connection visualization, or debug panel

### **State 3: Complex Graph**
**Setup:** 15 nodes (5 conversations, 7 notes, 3 tasks) with multiple connections
**Task:** "Find all conversations that reference the 'Project Brief' note"
**Expected:** User uses search, filter, or graph visualization to trace connections

### **State 4: Debug Scenario**
**Setup:** Conversation node connected to 3 notes, but one note is disabled
**Task:** "Figure out why the disabled note isn't being included in context"
**Expected:** User checks node properties, activation rules, connection settings

### **State 5: Bulk Operations**
**Setup:** 20 unsorted nodes
**Task:** "Tag all notes related to 'Q1 Planning' and organize into a project"
**Expected:** User uses multi-select, bulk property editing, and project assignment

### **State 6: Template Usage**
**Setup:** Empty workspace with template library visible
**Task:** "Create a new agent workflow from the 'Research Assistant' template"
**Expected:** User browses templates, selects one, instantiates it

### **State 7: API Configuration**
**Setup:** Settings modal open to AI & Connectors
**Task:** "Add Anthropic API key and set default model to Claude Opus"
**Expected:** User fills in API key field, changes dropdown to Opus

### **State 8: Performance Debug**
**Setup:** Large graph (50+ nodes) with slow rendering
**Task:** "Reduce visual effects to improve performance on this graph"
**Expected:** User finds graphics/performance settings, adjusts quality

### **State 9: Export Workflow**
**Setup:** Complete 5-node workflow ready to share
**Task:** "Export this workflow as a shareable template or diagram"
**Expected:** User finds export/template save options

### **State 10: Multi-Agent Orchestration**
**Setup:** Orchestrator node with 3 conversation nodes in sequence
**Task:** "Configure this to run conversations in parallel instead of sequence"
**Expected:** User finds orchestrator settings, changes execution mode

---

## Scoring Rubric (Power User Criteria)

### **Discoverability (0-10):**
- **9-10:** All features visible with clear labels, power-user density is GOOD
- **7-8:** Most features findable, some require menu exploration
- **5-6:** Half of features require searching or docs
- **3-4:** Features hidden in unexpected places
- **1-2:** Core functionality not discoverable

### **Learnability (0-10):**
- **9-10:** Labels use correct domain terms, tooltips explain edge cases
- **7-8:** Clear to power users, might confuse novices (this is fine!)
- **5-6:** Some ambiguous terms, needs better tooltips
- **3-4:** Misleading or inconsistent terminology
- **1-2:** Cryptic or unexplained features

### **Efficiency (0-10):**
- **9-10:** Optimized for power users, shortcuts everywhere, bulk ops
- **7-8:** Common workflows efficient, some friction
- **5-6:** Basic tasks work, lacks bulk operations
- **3-4:** Repetitive clicking, no shortcuts
- **1-2:** Inefficient by design

### **Information Density (0-10):**
- **9-10:** Dense but organized, all metadata visible (Figma/VS Code level)
- **7-8:** Good balance, minor omissions
- **5-6:** Some info hidden that should be visible
- **3-4:** Either too sparse (consumer) or too chaotic
- **1-2:** Can't see critical information

### **Overall Power User Score:**
Average of 4 criteria, weighted:
- Discoverability: 30%
- Learnability: 25%
- Efficiency: 25%
- Information Density: 20%

**Target:** 7.5+/10 for power user tools
**Acceptable:** 6.5+/10 (room for improvement)
**Problematic:** <6.0 (missing core expectations)

---

## What Changed from v1

**v1 (Consumer Lens):**
- ❌ "Too many buttons" = bad
- ❌ "Jargon" = confusing
- ❌ "Need to learn shortcuts" = friction
- ❌ Result: 3.0/10 clarity

**v2 (Power User Lens):**
- ✓ "All controls visible" = good
- ✓ "Domain terminology" = expected
- ✓ "Keyboard shortcuts listed" = helpful
- ✓ Expected: 6.5-8.0/10 (realistic for pro tools)

---

## Implementation

**File:** `e2e/smart-e2e/tier2/power-user-evaluation.spec.ts` (NEW)
**Replaces:** `blind-cognitive-proxy.spec.ts` (consumer lens)
**Uses:** Same AIVisionEvaluator, updated prompts
**Cost:** ~$0.30 (10 states × 3 passes × $0.01)
