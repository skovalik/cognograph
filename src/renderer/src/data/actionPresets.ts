/**
 * Action Presets for Web Project Types
 *
 * These are ActionNodeData configurations that create pre-configured action nodes.
 * They use the canonical actionTypes.ts type system (ActionTrigger + ActionStep),
 * NOT the legacy ActionTemplate type from ai-editor.ts.
 *
 * When a user selects a preset, it creates an ActionNodeData on the canvas
 * with the preset's trigger, conditions, and actions pre-filled.
 */

import type { ActionTrigger, ActionStep, ActionCondition } from '@shared/actionTypes'

// Template variable for user-customizable values in presets
export interface PresetVariable {
  name: string
  type: 'string' | 'number' | 'boolean'
  label: string
  description?: string
  defaultValue?: unknown
  required?: boolean
  options?: Array<{ label: string; value: unknown }>
}

export interface ActionPreset {
  id: string
  name: string
  description: string
  category: 'automation' | 'workflow' | 'integration' | 'deployment' | 'generation'
  icon?: string
  projectTypes: string[]
  trigger: ActionTrigger
  conditions: ActionCondition[]
  actions: ActionStep[]
  variables: PresetVariable[]
  requiresCCBridge?: boolean
}

// =============================================================================
// WordPress Action Presets
// =============================================================================

export const WEB_PROJECT_ACTION_PRESETS: ActionPreset[] = [
  // --- Preset 1: Push Content to WordPress ---
  {
    id: 'wp-push-content',
    name: 'Push Content to WordPress',
    description: 'When a page node status changes to "built", push its content to WordPress via REST API',
    category: 'integration',
    icon: 'Upload',
    projectTypes: ['wordpress-headless'],
    trigger: {
      type: 'property-change',
      property: 'page.status',
      toValue: 'built',
    },
    conditions: [],
    actions: [
      {
        id: 'wp-push-step-1',
        type: 'llm-call',
        onError: 'stop',
        config: {
          prompt: 'Read the page node "{{triggerNode.title}}" and generate WordPress-compatible HTML content from its component composition. Use any connected Design Tokens node for inline styles or class mappings. Output only the HTML content body.',
          variableName: 'wpHtmlContent',
          temperature: 0.3,
        },
      },
      {
        id: 'wp-push-step-2',
        type: 'http-request',
        onError: 'stop',
        config: {
          method: 'POST',
          url: '{{variables.wpSiteUrl}}{{variables.wpRestEndpoint}}/pages',
          headers: {
            'Authorization': '__credential__::{{variables.wpCredentialKey}}',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: '{{triggerNode.title}}',
            content: '{{variables.wpHtmlContent}}',
            status: 'draft',
            slug: '{{triggerNode.title}}',
          }),
          variableName: 'wpPushResponse',
          timeout: 30000,
        },
      },
    ],
    variables: [
      {
        name: 'publishStatus',
        type: 'string',
        label: 'WP Publish Status',
        description: 'Status when pushing to WordPress',
        defaultValue: 'draft',
        options: [
          { label: 'Draft', value: 'draft' },
          { label: 'Publish', value: 'publish' },
          { label: 'Pending Review', value: 'pending' },
        ],
      },
    ],
  },

  // --- Preset 2: Pull Content from WordPress ---
  {
    id: 'wp-pull-content',
    name: 'Pull Content from WordPress',
    description: 'Fetch content from WordPress and sync to page/note nodes',
    category: 'integration',
    icon: 'Download',
    projectTypes: ['wordpress-headless'],
    trigger: { type: 'manual' },
    conditions: [],
    actions: [
      {
        id: 'wp-pull-step-1',
        type: 'http-request',
        onError: 'stop',
        config: {
          method: 'GET',
          url: '{{variables.wpSiteUrl}}{{variables.wpRestEndpoint}}/pages?per_page=100',
          headers: {
            'Authorization': '__credential__::{{variables.wpCredentialKey}}',
          },
          variableName: 'wpPagesResponse',
          timeout: 30000,
        },
      },
      {
        id: 'wp-pull-step-2',
        type: 'llm-call',
        onError: 'continue',
        config: {
          prompt: 'Parse the WordPress API response in {{variables.wpPagesResponse}} and list each page with its title, slug, content summary, and status. Format as structured JSON for creating/updating page nodes.',
          variableName: 'parsedPages',
        },
      },
    ],
    variables: [],
  },

  // --- Preset 3: Sync ACF Field Groups ---
  {
    id: 'wp-sync-acf',
    name: 'Sync ACF Field Groups',
    description: 'Fetch ACF field group definitions from WordPress and create/update content-model nodes',
    category: 'integration',
    icon: 'RefreshCw',
    projectTypes: ['wordpress-headless'],
    trigger: { type: 'manual' },
    conditions: [],
    actions: [
      {
        id: 'wp-acf-step-1',
        type: 'http-request',
        onError: 'stop',
        config: {
          method: 'GET',
          url: '{{variables.wpSiteUrl}}{{variables.wpRestEndpoint}}/acf/v3/field-groups',
          headers: {
            'Authorization': '__credential__::{{variables.wpCredentialKey}}',
          },
          variableName: 'acfResponse',
          timeout: 30000,
        },
      },
      {
        id: 'wp-acf-step-2',
        type: 'llm-call',
        onError: 'continue',
        config: {
          prompt: 'Parse these ACF field group definitions from {{variables.acfResponse}}. For each field group, create a structured JSON object matching the ContentModelNoteData schema with all fields, types, and validation rules.',
          variableName: 'parsedFieldGroups',
        },
      },
      {
        id: 'wp-acf-step-3',
        type: 'create-node',
        onError: 'continue',
        config: {
          nodeType: 'note',
          title: 'ACF Sync Result',
          position: 'near-action',
          initialData: {
            noteMode: 'content-model',
          },
          variableName: 'createdContentModelNodeId',
        },
      },
    ],
    variables: [],
  },

  // --- Preset 4: Trigger Vercel Deploy ---
  {
    id: 'deploy-vercel',
    name: 'Trigger Vercel Deploy',
    description: 'Send a deploy webhook to Vercel when any page status changes to "live"',
    category: 'deployment',
    icon: 'Rocket',
    projectTypes: ['web-project', 'wordpress-headless', 'static-site'],
    trigger: {
      type: 'property-change',
      property: 'page.status',
      toValue: 'live',
    },
    conditions: [],
    actions: [
      {
        id: 'deploy-step-1',
        type: 'http-request',
        onError: 'retry',
        config: {
          method: 'POST',
          url: '{{variables.deployHookUrl}}',
          body: '{}',
          variableName: 'deployResponse',
          timeout: 15000,
        },
      },
    ],
    variables: [
      {
        name: 'deployHookUrl',
        type: 'string',
        label: 'Deploy Hook URL',
        description: 'Vercel/Netlify deploy webhook URL',
        required: true,
      },
    ],
  },

  // --- Preset 5: Generate Page via Claude Code ---
  {
    id: 'generate-page-cc',
    name: 'Generate Page (Claude Code)',
    description: 'Dispatch a page build task to Claude Code via the bridge. CC reads the page spec, design tokens, and component definitions, then generates the frontend code.',
    category: 'generation',
    icon: 'Wand2',
    projectTypes: ['web-project', 'wordpress-headless', 'static-site'],
    requiresCCBridge: true,
    trigger: { type: 'manual' },
    conditions: [],
    actions: [
      {
        id: 'gen-page-step-1',
        type: 'http-request',
        onError: 'stop',
        config: {
          method: 'POST',
          url: 'http://localhost:17242/dispatch',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'task',
            priority: 'normal',
            content: 'Build the page using the page spec from Cognograph MCP (get_page_spec for node {{triggerNode.id}}). Use the design tokens from get_design_tokens. Generate a Next.js page component and all sub-components.',
            contextNodes: ['{{triggerNode.id}}'],
            filePaths: [],
          }),
          variableName: 'ccDispatchResponse',
          timeout: 10000,
        },
      },
    ],
    variables: [],
  },

  // --- Preset 6: Generate Component via Claude Code ---
  {
    id: 'generate-component-cc',
    name: 'Generate Component (Claude Code)',
    description: 'Dispatch a component build task to Claude Code. CC reads the component spec and linked design tokens.',
    category: 'generation',
    icon: 'Component',
    projectTypes: ['web-project', 'wordpress-headless', 'static-site'],
    requiresCCBridge: true,
    trigger: { type: 'manual' },
    conditions: [],
    actions: [
      {
        id: 'gen-comp-step-1',
        type: 'http-request',
        onError: 'stop',
        config: {
          method: 'POST',
          url: 'http://localhost:17242/dispatch',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'task',
            priority: 'normal',
            content: 'Build the component specified in Cognograph node {{triggerNode.id}}. Read the component spec via get_page_spec. Apply design tokens from get_design_tokens. If the component maps to a CMS field, generate the data-fetching logic for the corresponding WPGraphQL query.',
            contextNodes: ['{{triggerNode.id}}'],
          }),
          variableName: 'ccDispatchResponse',
          timeout: 10000,
        },
      },
    ],
    variables: [],
  },
]

/**
 * Get action presets filtered by project type
 */
export function getPresetsForProjectType(projectTypeId: string): ActionPreset[] {
  return WEB_PROJECT_ACTION_PRESETS.filter(
    (p) => p.projectTypes.includes(projectTypeId),
  )
}

/**
 * Get all action presets
 */
export function getAllActionPresets(): ActionPreset[] {
  return WEB_PROJECT_ACTION_PRESETS
}

/**
 * Get action preset by ID
 */
export function getActionPresetById(id: string): ActionPreset | undefined {
  return WEB_PROJECT_ACTION_PRESETS.find((p) => p.id === id)
}
