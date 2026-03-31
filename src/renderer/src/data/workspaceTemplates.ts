// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Workspace Starter Templates
 *
 * Pre-built workspace layouts that create a complete multi-node structure.
 * Each template includes nodes with positions, data, and edges.
 *
 * These are larger-scale than node templates — they populate an empty workspace
 * with a starting structure of 5-10 nodes + edges + project hierarchy.
 *
 * TRACK 5 PHASE 5.2: Enhanced with 10 production-ready templates demonstrating
 * context injection, multi-agent orchestration, and key workflows.
 */

import type { NodeData, EdgeData } from '@shared/types'

export interface WorkspaceTemplateNode {
  /** Temporary ID used for edge references (replaced with uuid on instantiation) */
  tempId: string
  type: NodeData['type']
  position: { x: number; y: number }
  data: Partial<NodeData> & { title: string }
  dimensions?: { width: number; height: number }
}

export interface WorkspaceTemplateEdge {
  sourceTempId: string
  targetTempId: string
  label?: string
  /** Optional edge data overrides (strength, semanticType, lineStyle, etc.) */
  data?: Partial<EdgeData>
}

export interface WorkspaceTemplate {
  id: string
  name: string
  description: string
  icon: string // Lucide icon name
  color: string // Theme color for the card
  category: 'research' | 'writing' | 'development' | 'planning' | 'multi-agent' | 'tutorial'
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedTime: string
  featured?: boolean
  nodes: WorkspaceTemplateNode[]
  edges: WorkspaceTemplateEdge[]
}

// =============================================================================
// Built-in Templates (10 production-ready templates)
// =============================================================================

// =============================================================================
// SVG Data URI for N8 color palette swatch (5 colors, 380x80px)
// =============================================================================
const PALETTE_SVG_DATA_URI = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="380" height="80" viewBox="0 0 380 80">` +
  `<rect x="2" y="2" width="68" height="48" rx="4" fill="#0A0A0B" stroke="#333" stroke-width="1"/>` +
  `<rect x="78" y="2" width="68" height="48" rx="4" fill="#C8963E"/>` +
  `<rect x="154" y="2" width="68" height="48" rx="4" fill="#F5F5F5" stroke="#CCC" stroke-width="1"/>` +
  `<rect x="230" y="2" width="68" height="48" rx="4" fill="#1A1A1B" stroke="#333" stroke-width="1"/>` +
  `<rect x="306" y="2" width="68" height="48" rx="4" fill="#6366F1"/>` +
  `<text x="36" y="68" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#999">#0A0A0B</text>` +
  `<text x="112" y="68" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#999">#C8963E</text>` +
  `<text x="188" y="68" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#999">#F5F5F5</text>` +
  `<text x="264" y="68" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#999">#1A1A1B</text>` +
  `<text x="340" y="68" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#999">#6366F1</text>` +
  `</svg>`
)}`

// =============================================================================
// Edge style map for the onboarding template (applied post-instantiation)
// =============================================================================
export const ONBOARDING_EDGE_STYLES: Record<string, Partial<EdgeData>> = {
  'start-here->chat': {
    strength: 'light', semanticType: 'provides-context',
    lineStyle: 'solid', strokePreset: 'thin', arrowStyle: 'filled'
  },
  'brief->chat': {
    strength: 'strong', semanticType: 'provides-context',
    lineStyle: 'solid', strokePreset: 'bold', arrowStyle: 'filled'
  },
  'prefs->chat': {
    strength: 'normal', semanticType: 'provides-context',
    lineStyle: 'solid', strokePreset: 'normal', arrowStyle: 'filled'
  },
  'start-here->next': {
    strength: 'light', semanticType: 'references',
    lineStyle: 'dotted', strokePreset: 'thin', arrowStyle: 'outline'
  },
  'chat->hero-artifact': {
    strength: 'normal', semanticType: 'derives-from',
    lineStyle: 'solid', strokePreset: 'normal', arrowStyle: 'filled'
  },
  'chat->palette-artifact': {
    strength: 'light', semanticType: 'derives-from',
    lineStyle: 'solid', strokePreset: 'thin', arrowStyle: 'filled'
  }
}

export const WORKSPACE_TEMPLATES: WorkspaceTemplate[] = [
  // ============================================================================
  // DEFAULT ONBOARDING WORKSPACE — loaded for new users on first launch
  // ============================================================================
  {
    id: 'default-onboarding',
    name: 'Welcome Workspace',
    description: 'Learn Cognograph by exploring a pre-built workspace. No popups, no walkthroughs — the workspace is the tutorial.',
    icon: 'Compass',
    color: '#C8963E',
    category: 'tutorial',
    difficulty: 'beginner',
    estimatedTime: '2 minutes',
    featured: true,
    nodes: [
      // N1: Start Here (text node — no title field on TextNodeData, title used for gallery only)
      {
        tempId: 'start-here',
        type: 'text',
        position: { x: -257, y: 26 },
        data: {
          type: 'text',
          title: 'Start Here',
          content: '<h2>This is your workspace.</h2><p>Everything you see here is a real node. You can move them, edit them, delete them, or keep them.</p><p>The conversation below is live. The notes above it are feeding context into it. That is how Cognograph works — <strong>arrange information spatially, and the AI sees it.</strong></p><p>Start by clicking the chat node below and saying something.</p>',
          contentFormat: 'html',
          color: '#C8963E',
          isLandmark: true,
          icon: 'compass',
          contextRole: 'instruction',
          contextPriority: 'high'
        } as Partial<NodeData> & { title: string },
        dimensions: { width: 400, height: 180 }
      },
      // N2: Project Brief (note node)
      {
        tempId: 'brief',
        type: 'note',
        position: { x: 343, y: -29 },
        data: {
          type: 'note',
          title: 'Project Brief',
          content: 'I am building a personal portfolio site. The audience is potential clients — small business owners and startup founders who need a designer who understands both code and strategy.\n\nKey constraints:\n- Must load in under 2 seconds\n- Mobile-first (70% of traffic is mobile)\n- No stock photography — real work samples only\n- Clear call-to-action on every page',
          contextRole: 'background',
          contextPriority: 'high'
        } as Partial<NodeData> & { title: string },
        dimensions: { width: 320, height: 200 }
      },
      // N3: Design Preferences (note node)
      {
        tempId: 'prefs',
        type: 'note',
        position: { x: 882, y: 99 },
        data: {
          type: 'note',
          title: 'Design Preferences',
          content: 'Visual direction for the portfolio:\n\n- Clean, minimal layout. Generous whitespace.\n- Typography-driven. Large headings, readable body text.\n- Dark mode default, light mode available.\n- Accent color: warm gold (#C8963E) — confident but not aggressive.\n- No animations that serve only decoration. Every motion should communicate state or guide attention.\n- Inspired by: Stripe\'s documentation, Linear\'s interface, Vercel\'s landing pages.',
          contextRole: 'reference',
          contextPriority: 'medium'
        } as Partial<NodeData> & { title: string },
        dimensions: { width: 320, height: 220 }
      },
      // N4: How This Works (note node, NOT connected to chat — proves disconnection)
      {
        tempId: 'meta',
        type: 'note',
        position: { x: 862, y: 494 },
        data: {
          type: 'note',
          title: 'How This Works',
          content: 'What you are looking at:\n\nThe lines connecting these notes to the chat are edges. Edges control what the AI can see.\n\nWhen you send a message in the chat node, Cognograph collects content from every connected note and includes it in the prompt. The AI does not see disconnected nodes.\n\nThis means spatial arrangement is functional. Connecting a note to a conversation is not just organization — it changes what the AI knows.\n\nTry it: disconnect one of the notes from the chat (click the edge, press Delete). Then ask the AI about that topic. It will not know.\n\nTo create a new edge: drag from one node\'s edge handle to another.\nTo change edge strength: click an edge, then adjust in the properties panel. Stronger edges = deeper context injection.',
          color: '#6366F1',
          contextRole: 'instruction',
          contextPriority: 'low',
          includeInContext: false
        } as Partial<NodeData> & { title: string },
        dimensions: { width: 340, height: 320 }
      },
      // N5: Chat (conversation node with pre-populated exchange)
      {
        tempId: 'chat',
        type: 'conversation',
        position: { x: 10, y: 457 },
        data: {
          type: 'conversation',
          title: 'Chat',
          messages: [
            {
              id: 'onboarding-msg-user-001',
              role: 'user',
              content: 'Based on the project brief and design preferences, what would you recommend for the homepage hero section?',
              timestamp: Date.now() - 120000
            },
            {
              id: 'onboarding-msg-asst-001',
              role: 'assistant',
              content: 'Based on your brief and preferences, here is what I would recommend for the hero section:\n\n**Layout:** Full-viewport hero with a single headline, one supporting sentence, and a primary CTA button. No hero image — let the typography do the work, consistent with your Stripe/Linear/Vercel references.\n\n**Headline approach:** Lead with what you do for clients, not what you are. Something like "I design products that convert" rather than "Full-Stack Designer & Developer." Your audience (small business owners, startup founders) cares about outcomes.\n\n**Technical notes:**\n- Dark background (#0A0A0B or similar near-black) with your gold accent (#C8963E) on the CTA\n- System font stack for body (fast load), a single display font for the headline\n- Hero loads in a single render pass — no layout shift, no progressive reveal\n- The 2-second load budget means no hero video, no heavy WebGL. Static or CSS-only motion.\n\n**CTA:** "See my work" pointing to a portfolio grid immediately below the fold. One button. One action.\n\nWant me to draft the HTML/CSS structure?',
              timestamp: Date.now() - 60000
            }
          ],
          provider: 'anthropic',
          mode: 'chat',
          contextRole: 'scope',
          contextPriority: 'high'
        } as Partial<NodeData> & { title: string },
        dimensions: { width: 520, height: 680 }
      },
      // N6: Next Steps (text node)
      {
        tempId: 'next',
        type: 'text',
        position: { x: -628, y: 584 },
        data: {
          type: 'text',
          title: 'Next Steps',
          content: '<h3>What to try next</h3><ul><li><strong>Create a note</strong> — Right-click the canvas, or press <kbd>N</kbd></li><li><strong>Connect it to the chat</strong> — Drag from the note\'s edge handle to the chat node</li><li><strong>Switch to agent mode</strong> — Click the chat node\'s mode selector (top-right). Agent mode lets AI create and modify nodes on the canvas. It will ask before making changes.</li><li><strong>Try terminal mode</strong> — Same mode selector. Opens a CLI session inside the node. On desktop: choose Claude Code, Git Bash, PowerShell, or CMD. On web: terminal mode requires the desktop app.</li><li><strong>Start fresh</strong> — Select all (<kbd>Ctrl+A</kbd>), delete, and build your own workspace from scratch.</li></ul><p style="opacity: 0.6; margin-top: 1rem; font-size: 0.85em;">Keyboard shortcuts: <kbd>C</kbd> conversation &middot; <kbd>N</kbd> note &middot; <kbd>T</kbd> task &middot; <kbd>A</kbd> artifact &middot; <kbd>P</kbd> project &middot; <kbd>Ctrl+Z</kbd> undo</p>',
          contentFormat: 'html',
          includeInContext: false
        } as Partial<NodeData> & { title: string },
        dimensions: { width: 420, height: 260 }
      },
      // N7: HTML Artifact — Hero Section Draft
      {
        tempId: 'hero-artifact',
        type: 'artifact',
        position: { x: 1097, y: 949 },
        data: {
          type: 'artifact',
          title: 'Hero Section Draft',
          contentType: 'html',
          content: '<div style="background: #0A0A0B; color: #F5F5F5; font-family: system-ui, -apple-system, sans-serif; padding: 3rem 2rem; border-radius: 8px; text-align: center;"><h1 style="font-size: 2rem; font-weight: 700; margin: 0 0 0.75rem 0; line-height: 1.2;">I design products that convert.</h1><p style="font-size: 1rem; opacity: 0.7; margin: 0 0 1.5rem 0;">Strategy-driven design for founders who measure results.</p><a href="#" style="display: inline-block; background: #C8963E; color: #0A0A0B; padding: 0.75rem 2rem; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 0.95rem;">See my work</a></div>',
          source: { type: 'created', method: 'manual' },
          version: 1,
          versionHistory: [],
          versioningMode: 'update',
          injectionFormat: 'reference-only',
          collapsed: false,
          previewLines: 10,
          contextRole: 'reference',
          contextPriority: 'low',
          includeInContext: false
        } as Partial<NodeData> & { title: string },
        dimensions: { width: 1038, height: 323 }
      },
      // N8: Image Artifact — Color Palette Reference (SVG data URI)
      {
        tempId: 'palette-artifact',
        type: 'artifact',
        position: { x: 478, y: 1377 },
        data: {
          type: 'artifact',
          title: 'Color Palette Reference',
          contentType: 'image',
          content: PALETTE_SVG_DATA_URI,
          source: { type: 'created', method: 'manual' },
          version: 1,
          versionHistory: [],
          versioningMode: 'update',
          injectionFormat: 'reference-only',
          collapsed: false,
          previewLines: 5,
          contextRole: 'reference',
          contextPriority: 'low',
          includeInContext: false
        } as Partial<NodeData> & { title: string },
        dimensions: { width: 520, height: 210 }
      },
      // N9: Project Node — Portfolio Site Build (collapsed by default)
      {
        tempId: 'project-portfolio',
        type: 'project',
        position: { x: 1350, y: 666 },
        data: {
          type: 'project',
          title: 'Portfolio Site Build',
          description: 'This is a project node. It organizes related work into a collapsible group.\n\nExpand me to see what is inside.',
          color: '#C8963E',
          collapsed: true,
          childNodeIds: [] // Populated during instantiation with real UUIDs of N9a-c
        } as Partial<NodeData> & { title: string },
        dimensions: { width: 360, height: 120 }
      },
      // N9a: Site Architecture Notes (project child — note)
      {
        tempId: 'project-child-notes',
        type: 'note',
        position: { x: -154, y: 1260 },
        data: {
          type: 'note',
          title: 'Site Architecture Notes',
          content: 'Pages planned:\n1. Homepage (hero + portfolio grid + about teaser + CTA)\n2. Portfolio (filterable grid, case study detail pages)\n3. About (story + process + credentials)\n4. Contact (form + Cal.com embed for booking)\n\nNavigation: sticky header, 4 links, no hamburger on desktop.\nMobile: bottom nav or minimal hamburger.',
          parentId: 'project-portfolio' // Resolved to real UUID on instantiation
        } as Partial<NodeData> & { title: string },
        dimensions: { width: 402, height: 341 }
      },
      // N9b: Homepage Build (project child — task)
      {
        tempId: 'project-child-task',
        type: 'task',
        position: { x: 1350, y: 367 },
        data: {
          type: 'task',
          title: 'Homepage Build',
          description: 'Build the homepage based on the hero section draft.\n\nSubtasks:\n- [ ] Finalize hero copy and CTA\n- [ ] Build portfolio grid component\n- [ ] Add about teaser section\n- [ ] Mobile responsive pass\n- [ ] Performance audit (target: < 2s load)',
          status: 'in-progress',
          priority: 'medium',
          parentId: 'project-portfolio' // Resolved to real UUID on instantiation
        } as Partial<NodeData> & { title: string },
        dimensions: { width: 300, height: 200 }
      },
      // N9c: Performance Budget Check (project child — code artifact)
      {
        tempId: 'project-child-code',
        type: 'artifact',
        position: { x: 1069, y: 1424 },
        data: {
          type: 'artifact',
          title: 'Performance Budget Check',
          contentType: 'code',
          language: 'javascript',
          content: '// Performance budget enforcement\nconst BUDGET = {\n  fcp: 1200,   // First Contentful Paint (ms)\n  lcp: 2000,   // Largest Contentful Paint (ms)\n  cls: 0.1,    // Cumulative Layout Shift\n  tbt: 200     // Total Blocking Time (ms)\n};\n\nexport function checkBudget(metrics) {\n  return Object.entries(BUDGET).every(\n    ([key, limit]) => metrics[key] <= limit\n  );\n}',
          source: { type: 'created', method: 'manual' },
          version: 1,
          versionHistory: [],
          versioningMode: 'update',
          injectionFormat: 'full',
          collapsed: false,
          previewLines: 15,
          parentId: 'project-portfolio' // Resolved to real UUID on instantiation
        } as Partial<NodeData> & { title: string },
        dimensions: { width: 300, height: 240 }
      }
    ],
    edges: [
      // E1: Start Here -> Chat (light, instructional guide)
      {
        sourceTempId: 'start-here', targetTempId: 'chat', label: 'start here',
        data: { strength: 'light', semanticType: 'provides-context', lineStyle: 'solid', strokePreset: 'thin', arrowStyle: 'filled' }
      },
      // E2: Project Brief -> Chat (strong context)
      {
        sourceTempId: 'brief', targetTempId: 'chat', label: 'provides context',
        data: { strength: 'strong', semanticType: 'provides-context', lineStyle: 'solid', strokePreset: 'bold', arrowStyle: 'filled' }
      },
      // E3: Design Preferences -> Chat (normal context)
      {
        sourceTempId: 'prefs', targetTempId: 'chat', label: 'provides context',
        data: { strength: 'normal', semanticType: 'provides-context', lineStyle: 'solid', strokePreset: 'normal', arrowStyle: 'filled' }
      },
      // E4: Start Here -> Next Steps (reference, dotted)
      {
        sourceTempId: 'start-here', targetTempId: 'next', label: 'then try',
        data: { strength: 'light', semanticType: 'references', lineStyle: 'dotted', strokePreset: 'thin', arrowStyle: 'outline' }
      },
      // E5: Chat -> HTML Artifact (output, "created this")
      {
        sourceTempId: 'chat', targetTempId: 'hero-artifact', label: 'created this',
        data: { strength: 'normal', semanticType: 'derives-from', lineStyle: 'solid', strokePreset: 'normal', arrowStyle: 'filled' }
      },
      // E6: Chat -> Image Artifact (output, "created this")
      {
        sourceTempId: 'chat', targetTempId: 'palette-artifact', label: 'created this',
        data: { strength: 'light', semanticType: 'derives-from', lineStyle: 'solid', strokePreset: 'thin', arrowStyle: 'filled' }
      }
    ]
  },

  // ============================================================================
  // TEMPLATE 1: AI Research Assistant (HERO TEMPLATE)
  // ============================================================================
  {
    id: 'ai-research-assistant',
    name: 'AI Research Assistant',
    description: 'Analyze competitors with AI assistance. Perfect first template—shows context injection in action.',
    icon: 'Search',
    color: '#C8963E',
    category: 'research',
    difficulty: 'beginner',
    estimatedTime: '2 minutes',
    featured: true,
    nodes: [
      {
        tempId: 'project',
        type: 'project',
        position: { x: 300, y: 50 },
        data: {
          type: 'project',
          title: 'Competitive Analysis — SaaS Tools',
          description: 'Analyze 3 competitors to identify market gaps and positioning opportunities',
          collapsed: false,
          childNodeIds: []
        } as Partial<NodeData> & { title: string },
        dimensions: { width: 800, height: 500 }
      },
      {
        tempId: 'note-competitor-a',
        type: 'note',
        position: { x: 50, y: 150 },
        data: {
          type: 'note',
          title: 'Competitor A — All-in-One Workspace',
          content:
            'Leading all-in-one workspace platform (founded 2016, valued $10B+).\n\n**Strengths:**\n- Beautiful UX, extensive templates\n- Real-time collaboration\n- Broad feature set (docs, databases, wikis)\n\n**Weaknesses:**\n- Performance issues with large workspaces\n- Limited API access\n- Expensive for teams ($15-25/user/month)',
          contextRole: 'reference'
        } as Partial<NodeData> & { title: string }
      },
      {
        tempId: 'note-competitor-b',
        type: 'note',
        position: { x: 350, y: 150 },
        data: {
          type: 'note',
          title: 'Competitor B — Local Knowledge Base',
          content:
            'Popular local-first knowledge management tool (2020, bootstrapped).\n\n**Strengths:**\n- Graph view for networked thought\n- 1,000+ community plugins\n- Privacy (local files)\n- One-time payment model\n\n**Weaknesses:**\n- No native real-time collaboration\n- Steep learning curve for beginners\n- Plugin quality varies widely',
          contextRole: 'reference'
        } as Partial<NodeData> & { title: string }
      },
      {
        tempId: 'note-competitor-c',
        type: 'note',
        position: { x: 650, y: 150 },
        data: {
          type: 'note',
          title: 'Competitor C — Graph Database Tool',
          content:
            'Tool that pioneered bidirectional linking for notes (2019, well-funded).\n\n**Strengths:**\n- Daily notes workflow\n- Backlinks and graph database\n- Strong community\n\n**Weaknesses:**\n- Subscription-based pricing\n- Performance issues\n- Limited export options\n- Slower development pace',
          contextRole: 'reference'
        } as Partial<NodeData> & { title: string }
      },
      {
        tempId: 'note-differentiator',
        type: 'note',
        position: { x: 350, y: 350 },
        data: {
          type: 'note',
          title: 'Our Differentiator',
          content:
            "Cognograph's unique advantage:\n\n**Context Injection:** Spatial arrangement = functional. Connected notes automatically feed into AI prompts. Competitors require manual copy-paste or do not integrate AI at all.\n\n**Multi-Provider:** Works with Claude, Gemini, OpenAI. Competitors lock you into one AI or none.\n\n**Local-First:** Your data stays on your machine. No subscriptions for core features.",
          contextRole: 'background'
        } as Partial<NodeData> & { title: string }
      },
      {
        tempId: 'conversation',
        type: 'conversation',
        position: { x: 350, y: 600 },
        data: {
          type: 'conversation',
          title: 'Market Analysis Chat',
          messages: [
            {
              role: 'user',
              content: 'What are the common weaknesses across all 3 competitors?',
              timestamp: Date.now() - 120000
            },
            {
              role: 'assistant',
              content:
                'Based on the connected research notes, I can identify 3 common weaknesses:\n\n1. **Limited AI Integration**: None of these tools have automatic context injection. Users must manually copy-paste information between tools and AI assistants.\n\n2. **Collaboration Gaps**: Some tools lack real-time collaboration, others have performance issues, and some have expensive team pricing.\n\n3. **Lock-in Risk**: Subscription-based tools often keep your data on their servers with limited export options.\n\nCognograph addresses #1 directly (spatial context injection), offers flexibility for #2 (local-first), and avoids #3 (open file format).',
              timestamp: Date.now() - 60000
            }
          ],
          provider: 'anthropic'
        } as Partial<NodeData> & { title: string }
      }
    ],
    edges: [
      { sourceTempId: 'note-competitor-a', targetTempId: 'conversation', label: 'context' },
      { sourceTempId: 'note-competitor-b', targetTempId: 'conversation', label: 'context' },
      { sourceTempId: 'note-competitor-c', targetTempId: 'conversation', label: 'context' },
      { sourceTempId: 'note-differentiator', targetTempId: 'conversation', label: 'context' }
    ]
  },

  // ============================================================================
  // TEMPLATE 2: Content Creation Studio
  // ============================================================================
  {
    id: 'content-creation-studio',
    name: 'Content Creation Studio',
    description: 'Blog post workflow with AI feedback loops. Draft, edit, and refine content with AI assistance.',
    icon: 'PenTool',
    color: '#F0EDE8',
    category: 'writing',
    difficulty: 'beginner',
    estimatedTime: '5 minutes',
    nodes: [
      {
        tempId: 'project',
        type: 'project',
        position: { x: 200, y: 50 },
        data: {
          type: 'project',
          title: 'Blog Post — AI in 2026',
          description: 'Draft a thought leadership piece on AI developments',
          collapsed: false,
          childNodeIds: []
        } as Partial<NodeData> & { title: string },
        dimensions: { width: 700, height: 500 }
      },
      {
        tempId: 'outline',
        type: 'note',
        position: { x: 50, y: 150 },
        data: {
          type: 'note',
          title: 'Outline',
          content:
            '# Blog Post Structure\n\n## Introduction\n- Hook: AI has reached a turning point\n- Thesis: Multimodal agents are transforming workflows\n\n## Section 1: Current State\n- GPT-4, Claude 3, Gemini capabilities\n\n## Section 2: What Changed in 2026\n- Context windows (1M+ tokens)\n- Agentic behavior (tool use, memory)\n\n## Section 3: Implications\n- Knowledge work automation\n- New human-AI collaboration patterns\n\n## Conclusion\n- Call to action: Experiment now',
          contextRole: 'reference'
        } as Partial<NodeData> & { title: string }
      },
      {
        tempId: 'key-points',
        type: 'note',
        position: { x: 350, y: 150 },
        data: {
          type: 'note',
          title: 'Key Points',
          content:
            '**Thesis statements to weave in:**\n\n1. Context windows eliminated the "prompt engineering" era\n2. Agents can now maintain state across multi-hour sessions\n3. Cognograph demonstrates "spatial context injection" — a new paradigm\n4. The question is no longer "Can AI do X?" but "How do we orchestrate Y?"\n5. Enterprises adopting AI-first workflows are 3x more productive',
          contextRole: 'background'
        } as Partial<NodeData> & { title: string }
      },
      {
        tempId: 'style-guide',
        type: 'note',
        position: { x: 650, y: 150 },
        data: {
          type: 'note',
          title: 'Style Guide',
          content:
            '**Tone:** Conversational but authoritative\n**Audience:** Developers and product managers\n**Length:** 800-1200 words\n**Voice:** First person ("we"), avoid passive voice\n**Examples:** Concrete, real-world use cases\n**Formatting:** Use headers, bullets, code snippets',
          contextRole: 'instructions'
        } as Partial<NodeData> & { title: string }
      },
      {
        tempId: 'conversation',
        type: 'conversation',
        position: { x: 350, y: 400 },
        data: {
          type: 'conversation',
          title: 'Draft Assistant',
          messages: [
            {
              role: 'user',
              content: 'Write an introduction based on the outline and key points',
              timestamp: Date.now() - 180000
            },
            {
              role: 'assistant',
              content:
                "**Introduction: AI's Turning Point**\n\nWe're past the hype cycle. AI in 2026 isn't about clever prompts or one-off experiments—it's about multimodal agents transforming entire workflows. The shift from GPT-3's 4K context to models handling 1M+ tokens eliminated the era of \"prompt engineering.\" Now, agents maintain state across multi-hour sessions, use tools autonomously, and orchestrate complex tasks.\n\nThis isn't just an incremental improvement. It's a paradigm shift. The question is no longer \"Can AI do X?\" but \"How do we orchestrate Y?\" Tools like Cognograph demonstrate this with spatial context injection—a new way to organize knowledge that makes AI assistance automatic, not manual.\n\nLet us explore what changed, why it matters, and what you should do about it.",
              timestamp: Date.now() - 120000
            }
          ],
          provider: 'anthropic'
        } as Partial<NodeData> & { title: string }
      }
    ],
    edges: [
      { sourceTempId: 'outline', targetTempId: 'conversation', label: 'structure' },
      { sourceTempId: 'key-points', targetTempId: 'conversation', label: 'thesis' },
      { sourceTempId: 'style-guide', targetTempId: 'conversation', label: 'style' }
    ]
  },

  // ============================================================================
  // TEMPLATE 3: Software Project Planning
  // ============================================================================
  {
    id: 'software-project-planning',
    name: 'Software Project Planning',
    description: 'Task management with AI assistance. Plan features, track progress, get implementation guidance.',
    icon: 'Code',
    color: '#10b981',
    category: 'development',
    difficulty: 'intermediate',
    estimatedTime: '10 minutes',
    nodes: [
      {
        tempId: 'project',
        type: 'project',
        position: { x: 200, y: 50 },
        data: {
          type: 'project',
          title: 'Feature: User Authentication',
          description: 'Implement secure user authentication system',
          collapsed: false,
          childNodeIds: []
        } as Partial<NodeData> & { title: string },
        dimensions: { width: 700, height: 550 }
      },
      {
        tempId: 'task-1',
        type: 'task',
        position: { x: 50, y: 150 },
        data: {
          type: 'task',
          title: 'Design API endpoints',
          description: '/auth/register, /auth/login, /auth/logout, /auth/refresh',
          status: 'todo',
          priority: 'high'
        } as Partial<NodeData> & { title: string }
      },
      {
        tempId: 'task-2',
        type: 'task',
        position: { x: 300, y: 150 },
        data: {
          type: 'task',
          title: 'Implement password hashing',
          description: 'Use bcrypt with salt rounds = 12',
          status: 'todo',
          priority: 'high'
        } as Partial<NodeData> & { title: string }
      },
      {
        tempId: 'task-3',
        type: 'task',
        position: { x: 550, y: 150 },
        data: {
          type: 'task',
          title: 'Write integration tests',
          description: 'Test auth flow end-to-end',
          status: 'todo',
          priority: 'medium'
        } as Partial<NodeData> & { title: string }
      },
      {
        tempId: 'note-security',
        type: 'note',
        position: { x: 50, y: 350 },
        data: {
          type: 'note',
          title: 'Security Requirements',
          content:
            '**OWASP Guidelines:**\n\n1. Password minimum: 12 characters\n2. Rate limiting: 5 failed attempts → 15min lockout\n3. JWT expiry: 15 minutes (access), 7 days (refresh)\n4. HTTPS only in production\n5. No passwords in logs\n6. Hash with bcrypt (cost factor 12)\n7. CSRF protection via same-site cookies',
          contextRole: 'reference'
        } as Partial<NodeData> & { title: string }
      },
      {
        tempId: 'note-tech',
        type: 'note',
        position: { x: 400, y: 350 },
        data: {
          type: 'note',
          title: 'Tech Stack',
          content:
            '**Implementation details:**\n\n- **Backend:** Node.js + Express\n- **Database:** PostgreSQL with `users` table\n- **Hashing:** bcrypt (npm package)\n- **JWT:** jsonwebtoken (npm)\n- **Middleware:** express-rate-limit for rate limiting\n- **Testing:** Jest + Supertest for integration tests',
          contextRole: 'reference'
        } as Partial<NodeData> & { title: string }
      },
      {
        tempId: 'conversation',
        type: 'conversation',
        position: { x: 200, y: 600 },
        data: {
          type: 'conversation',
          title: 'Dev Assistant',
          messages: [],
          provider: 'anthropic'
        } as Partial<NodeData> & { title: string }
      }
    ],
    edges: [
      { sourceTempId: 'task-1', targetTempId: 'conversation' },
      { sourceTempId: 'task-2', targetTempId: 'conversation' },
      { sourceTempId: 'note-security', targetTempId: 'conversation', label: 'requirements' },
      { sourceTempId: 'note-tech', targetTempId: 'conversation', label: 'stack' }
    ]
  },

  // ============================================================================
  // TEMPLATE 4: Knowledge Management System
  // ============================================================================
  {
    id: 'knowledge-management',
    name: 'Knowledge Base',
    description: 'Organized notes with Q&A assistant. Build your personal knowledge graph with AI-powered search.',
    icon: 'Library',
    color: '#f59e0b',
    category: 'research',
    difficulty: 'beginner',
    estimatedTime: '5 minutes',
    nodes: [
      {
        tempId: 'project',
        type: 'project',
        position: { x: 150, y: 50 },
        data: {
          type: 'project',
          title: 'Knowledge Base — Programming Concepts',
          description: 'Organize your knowledge by topic',
          collapsed: false,
          childNodeIds: []
        } as Partial<NodeData> & { title: string },
        dimensions: { width: 600, height: 500 }
      },
      {
        tempId: 'category-1',
        type: 'note',
        position: { x: 50, y: 150 },
        data: {
          type: 'note',
          title: 'Category: Functional Programming',
          content:
            '**Key Concepts:**\n\n- **Pure Functions:** No side effects, deterministic output\n- **Immutability:** Data never changes, create new copies instead\n- **Higher-Order Functions:** Functions that take/return functions (map, filter, reduce)\n- **Composition:** Build complex logic from simple functions\n\n**Languages:** Haskell, Clojure, Scala, F#\n\n**Benefits:** Easier testing, parallelization, reasoning about code',
          contextRole: 'reference'
        } as Partial<NodeData> & { title: string }
      },
      {
        tempId: 'category-2',
        type: 'note',
        position: { x: 350, y: 150 },
        data: {
          type: 'note',
          title: 'Category: Design Patterns',
          content:
            '**Common Patterns:**\n\n1. **Singleton:** Ensure only one instance exists\n2. **Observer:** Notify subscribers of state changes\n3. **Factory:** Create objects without specifying exact class\n4. **Strategy:** Swap algorithms at runtime\n5. **Decorator:** Add behavior without modifying original\n\n**Source:** Gang of Four (1994)\n\n**Use case:** Write maintainable, extensible code',
          contextRole: 'reference'
        } as Partial<NodeData> & { title: string }
      },
      {
        tempId: 'ref-1',
        type: 'note',
        position: { x: 50, y: 350 },
        data: {
          type: 'note',
          title: 'Quick Ref: Git Commands',
          content:
            '**Essential Git Commands:**\n\n```bash\ngit init              # Initialize repo\ngit clone <url>       # Clone remote\ngit add .             # Stage all changes\ngit commit -m "msg"   # Commit\ngit push origin main  # Push to remote\ngit pull              # Fetch + merge\ngit branch <name>     # Create branch\ngit checkout <name>   # Switch branch\ngit merge <branch>    # Merge branch\ngit log --oneline     # View history\n```',
          contextRole: 'reference'
        } as Partial<NodeData> & { title: string }
      },
      {
        tempId: 'ref-2',
        type: 'note',
        position: { x: 350, y: 350 },
        data: {
          type: 'note',
          title: 'Links & Resources',
          content:
            '**Learning Resources:**\n\n- [MDN Web Docs](https://developer.mozilla.org/) — JS/Web reference\n- [The Pragmatic Programmer](https://pragprog.com/) — Classic book\n- [Refactoring.guru](https://refactoring.guru/) — Design patterns\n- [Git Book](https://git-scm.com/book/) — Official Git guide\n- [Stack Overflow](https://stackoverflow.com/) — Q&A community',
          contextRole: 'reference'
        } as Partial<NodeData> & { title: string }
      },
      {
        tempId: 'qa',
        type: 'conversation',
        position: { x: 200, y: 550 },
        data: {
          type: 'conversation',
          title: 'Q&A Assistant',
          messages: [],
          provider: 'anthropic'
        } as Partial<NodeData> & { title: string }
      }
    ],
    edges: [
      { sourceTempId: 'category-1', targetTempId: 'qa', label: 'context' },
      { sourceTempId: 'category-2', targetTempId: 'qa', label: 'context' },
      { sourceTempId: 'ref-1', targetTempId: 'qa', label: 'context' },
      { sourceTempId: 'ref-2', targetTempId: 'qa', label: 'context' }
    ]
  },

  // ============================================================================
  // TEMPLATE 5: Multi-Agent Pipeline (SHOWCASE TEMPLATE)
  // ============================================================================
  {
    id: 'multi-agent-pipeline',
    name: 'Multi-Agent Pipeline',
    description: 'Orchestrator coordinates 3 AI agents in sequence. Demonstrates agentic workflow automation.',
    icon: 'Network',
    color: '#6366f1',
    category: 'multi-agent',
    difficulty: 'advanced',
    estimatedTime: '15 minutes',
    featured: true,
    nodes: [
      {
        tempId: 'project',
        type: 'project',
        position: { x: 200, y: 50 },
        data: {
          type: 'project',
          title: 'AI Paper Summarization Pipeline',
          description: '3-agent workflow: Fetch → Analyze → Write Summary',
          collapsed: false,
          childNodeIds: []
        } as Partial<NodeData> & { title: string },
        dimensions: { width: 800, height: 500 }
      },
      {
        tempId: 'note-papers',
        type: 'note',
        position: { x: 50, y: 150 },
        data: {
          type: 'note',
          title: 'Paper URLs',
          content:
            '**Papers to analyze:**\n\n1. [Attention Is All You Need](https://arxiv.org/abs/1706.03762) — Transformers paper\n2. [BERT: Pre-training of Deep Bidirectional Transformers](https://arxiv.org/abs/1810.04805)\n3. [Language Models are Few-Shot Learners](https://arxiv.org/abs/2005.14165) — GPT-3 paper\n\n**Task:** Extract key contributions and compare approaches',
          contextRole: 'input'
        } as Partial<NodeData> & { title: string }
      },
      {
        tempId: 'orchestrator',
        type: 'orchestrator',
        position: { x: 400, y: 150 },
        data: {
          type: 'orchestrator',
          title: 'Research Pipeline',
          strategy: 'sequential',
          agents: [],
          budget: 50000,
          status: 'idle'
        } as Partial<NodeData> & { title: string }
      },
      {
        tempId: 'agent-a',
        type: 'conversation',
        position: { x: 50, y: 400 },
        data: {
          type: 'conversation',
          title: 'Agent A: PDF Fetcher',
          agentMode: 'agent',
          agentPreset: 'researcher',
          messages: [],
          provider: 'anthropic'
        } as Partial<NodeData> & { title: string }
      },
      {
        tempId: 'agent-b',
        type: 'conversation',
        position: { x: 300, y: 400 },
        data: {
          type: 'conversation',
          title: 'Agent B: Technical Analyzer',
          agentMode: 'agent',
          agentPreset: 'analyst',
          messages: [],
          provider: 'anthropic'
        } as Partial<NodeData> & { title: string }
      },
      {
        tempId: 'agent-c',
        type: 'conversation',
        position: { x: 550, y: 400 },
        data: {
          type: 'conversation',
          title: 'Agent C: Summary Writer',
          agentMode: 'agent',
          agentPreset: 'writer',
          messages: [],
          provider: 'anthropic'
        } as Partial<NodeData> & { title: string }
      }
    ],
    edges: [
      { sourceTempId: 'note-papers', targetTempId: 'orchestrator', label: 'input' },
      { sourceTempId: 'orchestrator', targetTempId: 'agent-a', label: 'step 1' },
      { sourceTempId: 'agent-a', targetTempId: 'agent-b', label: 'step 2' },
      { sourceTempId: 'agent-b', targetTempId: 'agent-c', label: 'step 3' }
    ]
  },

  // ============================================================================
  // TEMPLATE 6: Meeting Notes + Action Extraction
  // ============================================================================
  {
    id: 'meeting-notes-actions',
    name: 'Meeting Notes + Actions',
    description: 'Extract action items from meeting transcripts. Auto-creates task nodes from conversations.',
    icon: 'ListChecks',
    color: '#ec4899',
    category: 'planning',
    difficulty: 'beginner',
    estimatedTime: '5 minutes',
    nodes: [
      {
        tempId: 'project',
        type: 'project',
        position: { x: 200, y: 50 },
        data: {
          type: 'project',
          title: 'Q1 Planning Meeting',
          description: 'Strategic planning discussion and action items',
          collapsed: false,
          childNodeIds: []
        } as Partial<NodeData> & { title: string },
        dimensions: { width: 700, height: 500 }
      },
      {
        tempId: 'transcript',
        type: 'note',
        position: { x: 50, y: 150 },
        data: {
          type: 'note',
          title: 'Meeting Transcript — Jan 15, 2026',
          content:
            '**Attendees:** Sarah (PM), Alex (Eng), Jamie (Design)\n\n**Sarah:** Let us review Q1 goals. We need to finalize the roadmap by end of month.\n\n**Alex:** Agreed. I will update the technical spec with new API endpoints. Should take 3-4 days.\n\n**Jamie:** I will create mockups for the new onboarding flow. Need feedback by Friday.\n\n**Sarah:** Great. Also, we should schedule the team offsite for February. Jamie, can you scout locations?\n\n**Jamie:** Sure, I will send options by Wednesday.\n\n**Alex:** One more thing—we need to review the Q4 budget allocations. Numbers do not match what finance sent.\n\n**Sarah:** Good catch. I will follow up with finance today.',
          contextRole: 'input'
        } as Partial<NodeData> & { title: string }
      },
      {
        tempId: 'conversation',
        type: 'conversation',
        position: { x: 400, y: 150 },
        data: {
          type: 'conversation',
          title: 'Action Item Extractor',
          messages: [
            {
              role: 'user',
              content: 'Extract all action items from this meeting transcript',
              timestamp: Date.now() - 180000
            },
            {
              role: 'assistant',
              content:
                '**Action Items Identified:**\n\n1. **Alex:** Update technical spec with new API endpoints (3-4 days)\n2. **Jamie:** Create onboarding flow mockups, need feedback by Friday\n3. **Jamie:** Scout team offsite locations, send options by Wednesday\n4. **Sarah:** Follow up with finance on Q4 budget discrepancy (today)\n5. **Team:** Finalize Q1 roadmap by end of month\n\nI can create task nodes for each of these if you\'d like.',
              timestamp: Date.now() - 120000
            }
          ],
          provider: 'anthropic',
          extractionSettings: {
            enabled: true,
            triggers: ['on-demand'],
            types: ['task', 'note'],
            autoAccept: false
          }
        } as Partial<NodeData> & { title: string }
      },
      {
        tempId: 'task-1',
        type: 'task',
        position: { x: 50, y: 400 },
        data: {
          type: 'task',
          title: 'Update Q1 roadmap',
          description: 'Finalize roadmap by end of month (Jan 31)',
          status: 'todo',
          priority: 'high',
          assignee: 'Team'
        } as Partial<NodeData> & { title: string }
      },
      {
        tempId: 'task-2',
        type: 'task',
        position: { x: 300, y: 400 },
        data: {
          type: 'task',
          title: 'Schedule team offsite',
          description: 'Scout locations, send options by Wednesday',
          status: 'todo',
          priority: 'medium',
          assignee: 'Jamie'
        } as Partial<NodeData> & { title: string }
      },
      {
        tempId: 'task-3',
        type: 'task',
        position: { x: 550, y: 400 },
        data: {
          type: 'task',
          title: 'Review budget allocation',
          description: 'Follow up with finance on Q4 discrepancy',
          status: 'todo',
          priority: 'high',
          assignee: 'Sarah'
        } as Partial<NodeData> & { title: string }
      }
    ],
    edges: [
      { sourceTempId: 'transcript', targetTempId: 'conversation', label: 'extract from' },
      { sourceTempId: 'conversation', targetTempId: 'task-1', label: 'created' },
      { sourceTempId: 'conversation', targetTempId: 'task-2', label: 'created' },
      { sourceTempId: 'conversation', targetTempId: 'task-3', label: 'created' }
    ]
  },

  // ============================================================================
  // TEMPLATE 7: Academic Writing Assistant
  // ============================================================================
  {
    id: 'academic-writing',
    name: 'Academic Writing Assistant',
    description: 'Research paper workflow. Literature review → methodology → writing with AI guidance.',
    icon: 'GraduationCap',
    color: '#8b5cf6',
    category: 'writing',
    difficulty: 'intermediate',
    estimatedTime: '10 minutes',
    nodes: [
      {
        tempId: 'project',
        type: 'project',
        position: { x: 200, y: 50 },
        data: {
          type: 'project',
          title: 'Research Paper: Graph Neural Networks',
          description: 'Academic paper on GNN applications in social network analysis',
          collapsed: false,
          childNodeIds: []
        } as Partial<NodeData> & { title: string },
        dimensions: { width: 700, height: 550 }
      },
      {
        tempId: 'literature',
        type: 'note',
        position: { x: 50, y: 150 },
        data: {
          type: 'note',
          title: 'Literature Review',
          content:
            '**Key Papers Reviewed:**\n\n1. **Kipf & Welling (2017):** Semi-supervised classification with GCNs\n   - Introduced Graph Convolutional Networks\n   - Achieved SOTA on citation networks\n\n2. **Hamilton et al. (2017):** Inductive representation learning (GraphSAGE)\n   - Scalable to large graphs\n   - Sampling-based neighborhood aggregation\n\n3. **Veličković et al. (2018):** Graph Attention Networks (GAT)\n   - Attention mechanism for node features\n   - Improved interpretability\n\n**Research Gap:** Limited work on dynamic social networks with temporal edges',
          contextRole: 'reference'
        } as Partial<NodeData> & { title: string }
      },
      {
        tempId: 'methodology',
        type: 'note',
        position: { x: 350, y: 150 },
        data: {
          type: 'note',
          title: 'Methodology',
          content:
            '**Research Approach:**\n\n1. **Dataset:** Twitter social graph (10M nodes, 50M edges)\n2. **Preprocessing:** Remove bots, filter inactive users\n3. **Model:** Modified GAT with temporal encoding\n4. **Baselines:** GCN, GraphSAGE, standard GAT\n5. **Evaluation:** Node classification accuracy, F1 score\n6. **Training:** 80/10/10 split, early stopping, Adam optimizer\n\n**Hypothesis:** Temporal encoding improves prediction on dynamic graphs',
          contextRole: 'reference'
        } as Partial<NodeData> & { title: string }
      },
      {
        tempId: 'dataset',
        type: 'note',
        position: { x: 650, y: 150 },
        data: {
          type: 'note',
          title: 'Dataset Description',
          content:
            '**Twitter Social Graph (2025):**\n\n- **Nodes:** 10M users\n- **Edges:** 50M follow relationships\n- **Node features:** Tweet frequency, follower count, verified status\n- **Edge features:** Timestamp, interaction type\n- **Labels:** Community membership (5 categories)\n- **Temporal range:** Jan 2024 - Dec 2025\n\n**Preprocessing:**\n- Removed bots (verified via Botometer)\n- Filtered inactive users (<10 tweets/year)\n- Normalized features to [0,1]',
          contextRole: 'reference'
        } as Partial<NodeData> & { title: string }
      },
      {
        tempId: 'conversation',
        type: 'conversation',
        position: { x: 350, y: 400 },
        data: {
          type: 'conversation',
          title: 'Writing Coach',
          messages: [],
          provider: 'anthropic'
        } as Partial<NodeData> & { title: string }
      }
    ],
    edges: [
      { sourceTempId: 'literature', targetTempId: 'conversation', label: 'background' },
      { sourceTempId: 'methodology', targetTempId: 'conversation', label: 'approach' },
      { sourceTempId: 'dataset', targetTempId: 'conversation', label: 'data' }
    ]
  },

  // ============================================================================
  // TEMPLATE 8: Creative Brainstorming
  // ============================================================================
  {
    id: 'creative-brainstorming',
    name: 'Creative Brainstorming',
    description: 'Explore multiple creative directions. Fork conversations to try different story ideas.',
    icon: 'Lightbulb',
    color: '#f59e0b',
    category: 'writing',
    difficulty: 'beginner',
    estimatedTime: '5 minutes',
    nodes: [
      {
        tempId: 'project',
        type: 'project',
        position: { x: 200, y: 50 },
        data: {
          type: 'project',
          title: 'Novel: Sci-Fi Thriller',
          description: 'Brainstorm plot directions and character arcs',
          collapsed: false,
          childNodeIds: []
        } as Partial<NodeData> & { title: string },
        dimensions: { width: 700, height: 500 }
      },
      {
        tempId: 'character',
        type: 'note',
        position: { x: 50, y: 150 },
        data: {
          type: 'note',
          title: 'Character: Dr. Sarah Chen',
          content:
            '**Protagonist:**\n\n- **Role:** Chief Engineer on Mars Colony Alpha\n- **Background:** MIT PhD in astrobiology, 6 years on Mars\n- **Personality:** Methodical, skeptical, fiercely protective of her team\n- **Flaw:** Struggles to trust authority after losing her mentor to corporate negligence\n- **Goal:** Uncover the truth behind anomalous readings in subsurface ice\n\n**Character Arc:** Lone wolf → reluctant leader → inspiring figure',
          contextRole: 'reference'
        } as Partial<NodeData> & { title: string }
      },
      {
        tempId: 'setting',
        type: 'note',
        position: { x: 400, y: 150 },
        data: {
          type: 'note',
          title: 'Setting: Mars Colony 2145',
          content:
            '**World Details:**\n\n- **Location:** Valles Marineris, 200m underground\n- **Population:** 3,500 colonists\n- **Governance:** Corporate consortium (TriCorp, Martian Dynamics, Helios Industries)\n- **Tech level:** Fusion reactors, AI assistants, nanotech fabrication\n- **Atmosphere:** Partially terraformed (breathable in domes)\n- **Threat:** Unknown biological signatures detected in ancient ice deposits\n\n**Mood:** Claustrophobic, isolated, tension between science and profit',
          contextRole: 'reference'
        } as Partial<NodeData> & { title: string }
      },
      {
        tempId: 'plot-a',
        type: 'conversation',
        position: { x: 50, y: 400 },
        data: {
          type: 'conversation',
          title: 'Plot A: Alien Discovery',
          messages: [
            {
              role: 'user',
              content: 'Develop a plot where Sarah discovers an ancient alien structure beneath the ice',
              timestamp: Date.now() - 180000
            },
            {
              role: 'assistant',
              content:
                "**Plot Outline: The Martian Vault**\n\nSarah's team drilling ice core samples hits an anomaly—a perfectly smooth metallic surface 3km deep. It's not natural. Against corporate orders to halt work, she leads a covert excavation. The structure is vast: a vault containing biological samples from extinct civilizations across the galaxy.\n\n**Act 1:** Discovery and initial cover-up attempt by TriCorp\n**Act 2:** Sarah's team activates the vault, releasing a dormant AI guardian\n**Act 3:** Race to prevent the AI from \"sterilizing\" Mars (protocol for contaminated worlds)\n\n**Themes:** First contact, hubris of corporations, legacy of extinct civilizations",
              timestamp: Date.now() - 120000
            }
          ],
          provider: 'anthropic'
        } as Partial<NodeData> & { title: string }
      },
      {
        tempId: 'plot-b',
        type: 'conversation',
        position: { x: 400, y: 400 },
        data: {
          type: 'conversation',
          title: 'Plot B: Corporate Conspiracy',
          messages: [
            {
              role: 'user',
              content: 'Develop a plot where the anomaly is actually a corporate black site experiment gone wrong',
              timestamp: Date.now() - 180000
            },
            {
              role: 'assistant',
              content:
                "**Plot Outline: Subsurface Secrets**\n\nThe anomaly isn't alien—it's a secret TriCorp bioweapon research facility. They've been engineering extremophile organisms for terraforming, but one strain mutated and escaped containment. It's now spreading through the ice, threatening to breach the colony's water supply.\n\n**Act 1:** Sarah investigates disappearances among mining crews\n**Act 2:** Discovery of the black site and moral dilemma (expose vs. contain)\n**Act 3:** Sabotage from within, Sarah must choose between truth and survival\n\n**Themes:** Corporate greed, whistleblowing, sacrifice for the greater good",
              timestamp: Date.now() - 120000
            }
          ],
          provider: 'anthropic'
        } as Partial<NodeData> & { title: string }
      }
    ],
    edges: [
      { sourceTempId: 'character', targetTempId: 'plot-a', label: 'protagonist' },
      { sourceTempId: 'setting', targetTempId: 'plot-a', label: 'world' },
      { sourceTempId: 'character', targetTempId: 'plot-b', label: 'protagonist' },
      { sourceTempId: 'setting', targetTempId: 'plot-b', label: 'world' }
    ]
  },

  // ============================================================================
  // TEMPLATE 9: Development Workflow
  // ============================================================================
  {
    id: 'development-workflow',
    name: 'Code Review Workflow',
    description: 'AI-assisted code review. Get feedback on pull requests and create follow-up tasks.',
    icon: 'GitPullRequest',
    color: '#C8963E',
    category: 'development',
    difficulty: 'intermediate',
    estimatedTime: '10 minutes',
    nodes: [
      {
        tempId: 'project',
        type: 'project',
        position: { x: 200, y: 50 },
        data: {
          type: 'project',
          title: 'PR Review: Add User Profiles',
          description: 'Review code quality, identify issues, create fix tasks',
          collapsed: false,
          childNodeIds: []
        } as Partial<NodeData> & { title: string },
        dimensions: { width: 700, height: 500 }
      },
      {
        tempId: 'artifact-code',
        type: 'artifact',
        position: { x: 50, y: 150 },
        data: {
          type: 'artifact',
          title: 'user-profile.ts',
          content:
            'export interface UserProfile {\n  id: string\n  username: string\n  email: string\n  bio: string\n  avatarUrl: string\n  createdAt: Date\n  updatedAt: Date\n}\n\nexport class ProfileService {\n  async getProfile(userId: string): Promise<UserProfile> {\n    const response = await fetch(`/api/users/${userId}`)\n    return response.json() // ⚠️ Missing error handling\n  }\n\n  async updateProfile(userId: string, data: Partial<UserProfile>) {\n    // ⚠️ No validation, no type safety on response\n    fetch(`/api/users/${userId}`, {\n      method: \'PATCH\',\n      body: JSON.stringify(data)\n    })\n  }\n}',
          language: 'typescript',
          sourceType: 'code'
        } as Partial<NodeData> & { title: string }
      },
      {
        tempId: 'checklist',
        type: 'note',
        position: { x: 400, y: 150 },
        data: {
          type: 'note',
          title: 'Code Review Checklist',
          content:
            '**Review Criteria:**\n\n- [ ] Type safety (no `any`, all types explicit)\n- [ ] Error handling (try/catch, response validation)\n- [ ] Input validation (sanitize user data)\n- [ ] Security (no XSS, SQL injection risks)\n- [ ] Performance (minimize API calls, cache where possible)\n- [ ] Testing (unit tests for all public methods)\n- [ ] Documentation (JSDoc comments)\n- [ ] Naming conventions (camelCase, descriptive)\n- [ ] DRY principle (no code duplication)',
          contextRole: 'instructions'
        } as Partial<NodeData> & { title: string }
      },
      {
        tempId: 'conversation',
        type: 'conversation',
        position: { x: 200, y: 400 },
        data: {
          type: 'conversation',
          title: 'Code Reviewer',
          messages: [
            {
              role: 'user',
              content: 'Review this code against the checklist and identify issues',
              timestamp: Date.now() - 180000
            },
            {
              role: 'assistant',
              content:
                '**Code Review Findings:**\n\n**Critical Issues:**\n1. ❌ `getProfile()`: Missing error handling for failed fetch\n2. ❌ `updateProfile()`: Missing `await` and error handling\n3. ❌ No response validation (assume JSON is UserProfile)\n4. ❌ No input validation on `data` parameter\n\n**Type Safety:**\n5. ⚠️ `response.json()` not type-checked\n\n**Recommendations:**\n- Add try/catch blocks\n- Validate response status (throw on 4xx/5xx)\n- Use Zod schema for runtime validation\n- Add JSDoc comments\n- Return value from updateProfile()\n\n**Suggested fixes created as tasks below.**',
              timestamp: Date.now() - 120000
            }
          ],
          provider: 'anthropic'
        } as Partial<NodeData> & { title: string }
      },
      {
        tempId: 'task-fix',
        type: 'task',
        position: { x: 50, y: 650 },
        data: {
          type: 'task',
          title: 'Fix: Add error handling to ProfileService',
          description: 'Add try/catch, validate responses, handle edge cases',
          status: 'todo',
          priority: 'high'
        } as Partial<NodeData> & { title: string }
      }
    ],
    edges: [
      { sourceTempId: 'artifact-code', targetTempId: 'conversation', label: 'review this' },
      { sourceTempId: 'checklist', targetTempId: 'conversation', label: 'criteria' },
      { sourceTempId: 'conversation', targetTempId: 'task-fix', label: 'creates' }
    ]
  },

  // ============================================================================
  // TEMPLATE 10: Tutorial — Your First Workspace
  // ============================================================================
  {
    id: 'tutorial-first-workspace',
    name: 'Tutorial: Your First Workspace',
    description: 'Interactive guide for absolute beginners. Learn by doing with pre-created nodes.',
    icon: 'GraduationCap',
    color: '#10b981',
    category: 'tutorial',
    difficulty: 'beginner',
    estimatedTime: '3 minutes',
    featured: true,
    nodes: [
      {
        tempId: 'project',
        type: 'project',
        position: { x: 250, y: 100 },
        data: {
          type: 'project',
          title: 'My First Project',
          description: 'This is where you organize related ideas',
          collapsed: false,
          childNodeIds: []
        } as Partial<NodeData> & { title: string },
        dimensions: { width: 500, height: 400 }
      },
      {
        tempId: 'note-example',
        type: 'note',
        position: { x: 100, y: 200 },
        data: {
          type: 'note',
          title: 'Example Note',
          content:
            'This is a note. Notes store information that AI conversations can use as context.\n\n**Try this:**\n1. Read the content here\n2. Click the conversation node below\n3. Ask: "What\'s in the connected note?"\n4. Watch the AI use this text automatically!',
          contextRole: 'reference'
        } as Partial<NodeData> & { title: string }
      },
      {
        tempId: 'conversation-tutorial',
        type: 'conversation',
        position: { x: 250, y: 400 },
        data: {
          type: 'conversation',
          title: 'AI Assistant',
          messages: [],
          provider: 'anthropic'
        } as Partial<NodeData> & { title: string }
      }
    ],
    edges: [{ sourceTempId: 'note-example', targetTempId: 'conversation-tutorial', label: 'context' }]
  }
]

// =============================================================================
// Onboarding Template Helpers
// =============================================================================

/**
 * Get the default onboarding template.
 */
export function getOnboardingTemplate(): WorkspaceTemplate | undefined {
  return WORKSPACE_TEMPLATES.find(t => t.id === 'default-onboarding')
}
