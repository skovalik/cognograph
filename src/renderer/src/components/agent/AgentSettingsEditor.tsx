import React, { useState } from 'react'
import { ChevronDown, ChevronRight, HelpCircle } from 'lucide-react'
import type { AgentSettings } from '@shared/types'
import { Checkbox } from '../ui/checkbox'

interface AgentSettingsEditorProps {
  nodeId: string
  settings: AgentSettings
  preset: string
  onChange: (settings: AgentSettings) => void
}

/**
 * Agent Settings Editor - Permission and behavior configuration
 *
 * Features:
 * - Grouped sections (Permissions, Behavior, Limits)
 * - Switches preset to 'custom' on any edit
 * - Tooltips for each setting
 * - Default: Permissions expanded, others collapsed
 */
export const AgentSettingsEditor: React.FC<AgentSettingsEditorProps> = ({
  settings,
  preset,
  onChange
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [permissionsExpanded, setPermissionsExpanded] = useState(true)
  const [behaviorExpanded, setBehaviorExpanded] = useState(false)
  const [limitsExpanded, setLimitsExpanded] = useState(false)

  const handleChange = (field: keyof AgentSettings, value: unknown) => {
    onChange({ ...settings, [field]: value })
  }

  const isCustom = preset === 'custom'

  return (
    <div className="border rounded">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium gui-text-secondary hover:bg-gray-500/10 transition-colors"
      >
        <span>Agent Settings</span>
        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t">
          {/* Preset indicator */}
          <div className="p-2 bg-blue-500/10 border-b border-blue-500/30">
            <p className="text-xs gui-text-secondary">
              {isCustom ? (
                <>
                  <span className="font-semibold">Custom</span> settings
                </>
              ) : (
                <>
                  Preset: <span className="font-semibold">{preset}</span> → Editing switches to Custom
                </>
              )}
            </p>
          </div>

          {/* Group 1: Permissions */}
          <div className="border-b">
            <button
              onClick={() => setPermissionsExpanded(!permissionsExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium gui-text-secondary hover:bg-gray-500/10 transition-colors"
            >
              <span>▸ Permissions</span>
              {permissionsExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {permissionsExpanded && (
              <div className="px-3 pb-3 space-y-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={settings.canCreateNodes ?? true}
                    onCheckedChange={(checked) => handleChange('canCreateNodes', checked)}
                  />
                  <span className="gui-text-primary">Can Create Nodes</span>
                  <span
                    className="text-[var(--text-muted)] ml-auto"
                    title="Allow agent to create new nodes and configure context"
                  >
                    <HelpCircle className="w-3 h-3" />
                  </span>
                </label>

                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={settings.canDeleteNodes ?? false}
                    onCheckedChange={(checked) => handleChange('canDeleteNodes', checked)}
                  />
                  <span className="gui-text-primary">Can Delete Nodes</span>
                  <span
                    className="text-[var(--text-muted)] ml-auto"
                    title="Allow agent to delete nodes from canvas. Disable for read-only agents."
                  >
                    <HelpCircle className="w-3 h-3" />
                  </span>
                </label>

                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={settings.canModifyNodes ?? true}
                    onCheckedChange={(checked) => handleChange('canModifyNodes', checked)}
                  />
                  <span className="gui-text-primary">Can Modify Nodes</span>
                  <span
                    className="text-[var(--text-muted)] ml-auto"
                    title="Allow agent to edit existing node content and properties"
                  >
                    <HelpCircle className="w-3 h-3" />
                  </span>
                </label>

                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={settings.canCreateEdges ?? true}
                    onCheckedChange={(checked) => handleChange('canCreateEdges', checked)}
                  />
                  <span className="gui-text-primary">Can Create Edges</span>
                  <span
                    className="text-[var(--text-muted)] ml-auto"
                    title="Allow agent to connect nodes with edges"
                  >
                    <HelpCircle className="w-3 h-3" />
                  </span>
                </label>

                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={settings.canDeleteEdges ?? false}
                    onCheckedChange={(checked) => handleChange('canDeleteEdges', checked)}
                  />
                  <span className="gui-text-primary">Can Delete Edges</span>
                  <span
                    className="text-[var(--text-muted)] ml-auto"
                    title="Allow agent to remove connections between nodes"
                  >
                    <HelpCircle className="w-3 h-3" />
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Group 2: Behavior */}
          <div className="border-b">
            <button
              onClick={() => setBehaviorExpanded(!behaviorExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium gui-text-secondary hover:bg-gray-500/10 transition-colors"
            >
              <span>▸ Behavior</span>
              {behaviorExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {behaviorExpanded && (
              <div className="px-3 pb-3 space-y-3">
                <div>
                  <label className="block text-xs font-medium gui-text-secondary mb-1">Scope Mode</label>
                  <div className="space-y-1">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="scopeMode"
                        value="connected"
                        checked={settings.scopeMode === 'connected'}
                        onChange={() => handleChange('scopeMode', 'connected')}
                        className="w-3 h-3"
                      />
                      <span className="gui-text-primary">Connected — Only nodes linked via edges</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="scopeMode"
                        value="workspace"
                        checked={settings.scopeMode === 'workspace'}
                        onChange={() => handleChange('scopeMode', 'workspace')}
                        className="w-3 h-3"
                      />
                      <span className="gui-text-primary">Entire Workspace — All nodes accessible</span>
                    </label>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={settings.autoExecuteTools ?? true}
                    onCheckedChange={(checked) => handleChange('autoExecuteTools', checked)}
                  />
                  <span className="gui-text-primary">Auto-execute Tools</span>
                  <span
                    className="text-[var(--text-muted)] ml-auto"
                    title="Run tools automatically without approval"
                  >
                    <HelpCircle className="w-3 h-3" />
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Group 3: Limits */}
          <div>
            <button
              onClick={() => setLimitsExpanded(!limitsExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium gui-text-secondary hover:bg-gray-500/10 transition-colors"
            >
              <span>▸ Limits</span>
              {limitsExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {limitsExpanded && (
              <div className="px-3 pb-3 space-y-3">
                <div>
                  <label className="block text-xs font-medium gui-text-secondary mb-1">
                    Max Tool Calls
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={settings.maxToolCalls ?? 10}
                    onChange={(e) => handleChange('maxToolCalls', parseInt(e.target.value, 10))}
                    className="w-full gui-input border rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium gui-text-secondary mb-1">
                    Allowed Node Types
                  </label>
                  <div className="space-y-1 max-h-[100px] overflow-y-auto p-2 border rounded bg-gray-500/5">
                    {['note', 'task', 'project', 'conversation', 'artifact', 'text'].map((type) => (
                      <label key={type} className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox
                          checked={(settings.allowedNodeTypes ?? []).includes(type)}
                          onCheckedChange={(checked) => {
                            const current = settings.allowedNodeTypes ?? []
                            const updated = checked
                              ? [...current, type]
                              : current.filter((t) => t !== type)
                            handleChange('allowedNodeTypes', updated)
                          }}
                        />
                        <span className="gui-text-primary capitalize">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
