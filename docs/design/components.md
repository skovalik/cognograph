# Component Inventory

Canonical names and nomenclature for all UI elements in Cognograph.

## Nomenclature

| Element | Name | CSS Class / Pattern |
|---------|------|---------------------|
| Node container | **Card** | `.cognograph-node` |
| Card top section | **Card Header** | `.cognograph-node__header` |
| Card middle | **Card Body** | `.cognograph-node__body` |
| Card bottom | **Card Footer** | `.cognograph-node__footer` |
| Side panel | **Panel** | `.gui-panel` |
| Floating window | **Modal** | overlay + centered panel |
| Right-click menu | **Context Menu** | `<ContextMenu>` |
| Status indicator | **Badge** | `.status-badge` |
| Tag/label | **Tag** | property badge with color dot |
| Form field | **Input** | `.gui-input` |
| Dropdown selector | **Select** | `<UnifiedPropertyDropdown>` |
| Action trigger | **Button** | `.gui-accent` / `.gui-button` |
| Connection point | **Handle** | `.react-flow__handle` |
| Connection line | **Edge** | `.react-flow__edge-path` |
| Notification | **Toast** | `<SciFiToast>` |
| Tab selector | **Tab** | settings modal nav items |
| Collapsible section | **Accordion** | expandable sections in panels |
| Color dot | **Swatch** | color picker circles |
| Slider | **Range** | `<input type="range">` |
| Toggle switch | **Switch** | boolean checkbox styled as switch |
| Toolbar button | **Tool** | `<Toolbar>` icon buttons |
| Canvas label | **Annotation** | `.text-node` |

## Card Types (Node Components)

| Type | Component | Color Token | Min Size |
|------|-----------|-------------|----------|
| Conversation | `ConversationNode.tsx` | `--node-conversation` | 150x80 |
| Project | `ProjectNode.tsx` | `--node-project` | 250x200 |
| Note | `NoteNode.tsx` | `--node-note` | 150x80 |
| Task | `TaskNode.tsx` | `--node-task` | 150x80 |
| Artifact | `ArtifactNode.tsx` | `--node-artifact` | 150x80 |
| Workspace | `WorkspaceNode.tsx` | `--node-workspace` | 280x80 |
| Text | `TextNode.tsx` | `--node-text` | 100x30 |
| Action | `ActionNode.tsx` | `--node-action` | 220x80 |

## Panel Components

| Panel | File | Default Width |
|-------|------|---------------|
| Properties | `PropertiesPanel.tsx` | 360px |
| Chat | `ChatPanel.tsx` | 400px |
| Left Sidebar | `LeftSidebar.tsx` | 320px |
| Theme Settings | `ThemeSettingsPanel.tsx` | (within settings) |
| Extractions | `ExtractionsPanel.tsx` | (within sidebar) |
| Layers | `LayersPanel.tsx` | (within sidebar) |

## Modal Components

| Modal | File | Size |
|-------|------|------|
| Settings | `SettingsModal.tsx` | Large (tabbed) |
| AI Editor | `AIEditorModal.tsx` | Medium |
| Context Settings | `ContextSettingsModal.tsx` | Small |
| Floating Properties | `FloatingPropertiesModal.tsx` | Custom |

## Button Variants

| Variant | Class | Usage |
|---------|-------|-------|
| Primary | `.gui-accent` | Primary actions (Save, Create) |
| Secondary | `.gui-button` | Secondary actions (Cancel, Back) |
| Ghost | transparent bg | Tertiary actions, icon-only buttons |
| Icon | square, icon-only | Toolbar buttons, close buttons |
| Danger | red bg | Destructive actions (Delete) |

## Badge Variants

| Variant | Usage | Example |
|---------|-------|---------|
| Status | Task/node status | "In Progress" with blue dot |
| Priority | Task priority | "High" with red indicator |
| Property | Custom properties | Key-value display |
| Count | Numeric indicators | Attachment count, message count |
| Type | Node type label | "note", "task" in footer |
