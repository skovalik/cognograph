# IMPLEMENTATION - Part 3: Panels, Persistence, Chat

---

## Phase 3: Properties Panel

### Step 3.1: Properties Panel Component

**File: `src/renderer/src/components/PropertiesPanel.tsx`**
```tsx
import { useCallback, useMemo } from 'react';
import { X, Trash2 } from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspaceStore';
import type { NodeData, ConversationNodeData, ProjectNodeData, NoteNodeData, TaskNodeData } from '@shared/types';

// -----------------------------------------------------------------------------
// Field Components
// -----------------------------------------------------------------------------

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

const Field = ({ label, children }: FieldProps) => (
  <div className="space-y-1">
    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
      {label}
    </label>
    {children}
  </div>
);

const TextInput = ({ 
  value, 
  onChange, 
  placeholder 
}: { 
  value: string; 
  onChange: (value: string) => void; 
  placeholder?: string;
}) => (
  <input
    type="text"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
  />
);

const TextArea = ({ 
  value, 
  onChange, 
  placeholder,
  rows = 4
}: { 
  value: string; 
  onChange: (value: string) => void; 
  placeholder?: string;
  rows?: number;
}) => (
  <textarea
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    rows={rows}
    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
  />
);

const Select = <T extends string>({ 
  value, 
  onChange, 
  options 
}: { 
  value: T; 
  onChange: (value: T) => void; 
  options: { value: T; label: string }[];
}) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value as T)}
    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
  >
    {options.map((opt) => (
      <option key={opt.value} value={opt.value}>
        {opt.label}
      </option>
    ))}
  </select>
);

const ColorPicker = ({ 
  value, 
  onChange 
}: { 
  value: string; 
  onChange: (value: string) => void;
}) => {
  const colors = [
    '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', 
    '#ef4444', '#ec4899', '#6366f1', '#14b8a6'
  ];
  
  return (
    <div className="flex gap-2 flex-wrap">
      {colors.map((color) => (
        <button
          key={color}
          onClick={() => onChange(color)}
          className={`w-8 h-8 rounded-full border-2 transition-transform ${
            value === color ? 'border-white scale-110' : 'border-transparent'
          }`}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
};

// -----------------------------------------------------------------------------
// Type-Specific Editors
// -----------------------------------------------------------------------------

interface EditorProps<T extends NodeData> {
  data: T;
  onChange: (updates: Partial<T>) => void;
}

const ConversationEditor = ({ data, onChange }: EditorProps<ConversationNodeData>) => (
  <div className="space-y-4">
    <Field label="Title">
      <TextInput 
        value={data.title} 
        onChange={(title) => onChange({ title })} 
        placeholder="Conversation title"
      />
    </Field>
    <Field label="AI Provider">
      <Select
        value={data.provider}
        onChange={(provider) => onChange({ provider })}
        options={[
          { value: 'anthropic', label: 'Claude (Anthropic)' },
          { value: 'gemini', label: 'Gemini (Google)' },
          { value: 'openai', label: 'GPT (OpenAI)' },
        ]}
      />
    </Field>
    <Field label="Messages">
      <div className="text-sm text-gray-400">
        {data.messages.length} message{data.messages.length !== 1 ? 's' : ''}
      </div>
    </Field>
  </div>
);

const ProjectEditor = ({ data, onChange }: EditorProps<ProjectNodeData>) => (
  <div className="space-y-4">
    <Field label="Title">
      <TextInput 
        value={data.title} 
        onChange={(title) => onChange({ title })} 
        placeholder="Project title"
      />
    </Field>
    <Field label="Description">
      <TextArea 
        value={data.description} 
        onChange={(description) => onChange({ description })} 
        placeholder="Describe this project..."
        rows={4}
      />
    </Field>
    <Field label="Color">
      <ColorPicker 
        value={data.color} 
        onChange={(color) => onChange({ color })} 
      />
    </Field>
    <Field label="Children">
      <div className="text-sm text-gray-400">
        {data.childNodeIds.length} item{data.childNodeIds.length !== 1 ? 's' : ''} in this project
      </div>
    </Field>
  </div>
);

const NoteEditor = ({ data, onChange }: EditorProps<NoteNodeData>) => (
  <div className="space-y-4">
    <Field label="Title">
      <TextInput 
        value={data.title} 
        onChange={(title) => onChange({ title })} 
        placeholder="Note title"
      />
    </Field>
    <Field label="Content">
      <TextArea 
        value={data.content} 
        onChange={(content) => onChange({ content })} 
        placeholder="Write your note..."
        rows={10}
      />
    </Field>
  </div>
);

const TaskEditor = ({ data, onChange }: EditorProps<TaskNodeData>) => (
  <div className="space-y-4">
    <Field label="Title">
      <TextInput 
        value={data.title} 
        onChange={(title) => onChange({ title })} 
        placeholder="Task title"
      />
    </Field>
    <Field label="Description">
      <TextArea 
        value={data.description} 
        onChange={(description) => onChange({ description })} 
        placeholder="Task details..."
        rows={3}
      />
    </Field>
    <Field label="Status">
      <Select
        value={data.status}
        onChange={(status) => onChange({ status })}
        options={[
          { value: 'todo', label: 'To Do' },
          { value: 'in-progress', label: 'In Progress' },
          { value: 'done', label: 'Done' },
        ]}
      />
    </Field>
    <Field label="Priority">
      <Select
        value={data.priority}
        onChange={(priority) => onChange({ priority })}
        options={[
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
        ]}
      />
    </Field>
  </div>
);

// -----------------------------------------------------------------------------
// Main Properties Panel
// -----------------------------------------------------------------------------

export const PropertiesPanel = () => {
  const selectedNodeIds = useWorkspaceStore(state => state.selectedNodeIds);
  const nodes = useWorkspaceStore(state => state.nodes);
  const updateNode = useWorkspaceStore(state => state.updateNode);
  const deleteNodes = useWorkspaceStore(state => state.deleteNodes);
  const closeProperties = useWorkspaceStore(state => state.closeProperties);
  
  const selectedNode = useMemo(() => {
    if (selectedNodeIds.length !== 1) return null;
    return nodes.find(n => n.id === selectedNodeIds[0]) || null;
  }, [selectedNodeIds, nodes]);
  
  const handleChange = useCallback((updates: Partial<NodeData>) => {
    if (selectedNode) {
      updateNode(selectedNode.id, updates);
    }
  }, [selectedNode, updateNode]);
  
  const handleDelete = useCallback(() => {
    if (selectedNode) {
      deleteNodes([selectedNode.id]);
      closeProperties();
    }
  }, [selectedNode, deleteNodes, closeProperties]);
  
  if (!selectedNode) {
    return (
      <div className="w-80 bg-gray-900 border-l border-gray-700 p-4">
        <div className="text-gray-500 text-sm text-center mt-8">
          {selectedNodeIds.length === 0 
            ? 'Select a node to edit its properties'
            : `${selectedNodeIds.length} nodes selected`}
        </div>
      </div>
    );
  }
  
  const nodeTypeLabels = {
    conversation: 'Conversation',
    project: 'Project',
    note: 'Note',
    task: 'Task',
  };
  
  return (
    <div className="w-80 bg-gray-900 border-l border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h2 className="font-semibold text-gray-200">
          {nodeTypeLabels[selectedNode.data.type]}
        </h2>
        <button 
          onClick={closeProperties}
          className="p-1 hover:bg-gray-700 rounded"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {selectedNode.data.type === 'conversation' && (
          <ConversationEditor 
            data={selectedNode.data} 
            onChange={handleChange} 
          />
        )}
        {selectedNode.data.type === 'project' && (
          <ProjectEditor 
            data={selectedNode.data} 
            onChange={handleChange} 
          />
        )}
        {selectedNode.data.type === 'note' && (
          <NoteEditor 
            data={selectedNode.data} 
            onChange={handleChange} 
          />
        )}
        {selectedNode.data.type === 'task' && (
          <TaskEditor 
            data={selectedNode.data} 
            onChange={handleChange} 
          />
        )}
      </div>
      
      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-700">
        <button
          onClick={handleDelete}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-900/50 hover:bg-red-900 text-red-300 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete Node
        </button>
      </div>
    </div>
  );
};
```

---

## Phase 4: Persistence

### Step 4.1: Main Process - File Operations

**File: `src/main/workspace.ts`**
```typescript
import { app, ipcMain } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { WorkspaceData, WorkspaceInfo, IPCResponse } from '@shared/types';

// -----------------------------------------------------------------------------
// Paths
// -----------------------------------------------------------------------------

const getWorkspacesDir = (): string => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'workspaces');
};

const ensureWorkspacesDir = async (): Promise<void> => {
  const dir = getWorkspacesDir();
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
};

const getWorkspacePath = (id: string): string => {
  return path.join(getWorkspacesDir(), `${id}.json`);
};

// -----------------------------------------------------------------------------
// Operations
// -----------------------------------------------------------------------------

export const saveWorkspace = async (data: WorkspaceData): Promise<IPCResponse> => {
  try {
    await ensureWorkspacesDir();
    const filePath = getWorkspacePath(data.id);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return { success: true, data: { path: filePath } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save workspace';
    console.error('Save workspace error:', error);
    return { success: false, error: message };
  }
};

export const loadWorkspace = async (id: string): Promise<IPCResponse<WorkspaceData>> => {
  try {
    const filePath = getWorkspacePath(id);
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content) as WorkspaceData;
    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load workspace';
    console.error('Load workspace error:', error);
    return { success: false, error: message };
  }
};

export const listWorkspaces = async (): Promise<IPCResponse<WorkspaceInfo[]>> => {
  try {
    await ensureWorkspacesDir();
    const dir = getWorkspacesDir();
    const files = await fs.readdir(dir);
    const workspaces: WorkspaceInfo[] = [];
    
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      
      try {
        const filePath = path.join(dir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content) as WorkspaceData;
        
        workspaces.push({
          id: data.id,
          name: data.name,
          path: filePath,
          updatedAt: data.updatedAt,
          nodeCount: data.nodes.length,
        });
      } catch {
        // Skip invalid files
        continue;
      }
    }
    
    // Sort by most recently updated
    workspaces.sort((a, b) => b.updatedAt - a.updatedAt);
    
    return { success: true, data: workspaces };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list workspaces';
    console.error('List workspaces error:', error);
    return { success: false, error: message };
  }
};

export const deleteWorkspace = async (id: string): Promise<IPCResponse> => {
  try {
    const filePath = getWorkspacePath(id);
    await fs.unlink(filePath);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete workspace';
    console.error('Delete workspace error:', error);
    return { success: false, error: message };
  }
};

export const getLastWorkspaceId = async (): Promise<string | null> => {
  try {
    const result = await listWorkspaces();
    if (result.success && result.data && result.data.length > 0) {
      return result.data[0].id;
    }
    return null;
  } catch {
    return null;
  }
};

// -----------------------------------------------------------------------------
// IPC Registration
// -----------------------------------------------------------------------------

export const registerWorkspaceHandlers = (): void => {
  ipcMain.handle('workspace:save', async (_, data: WorkspaceData) => {
    return saveWorkspace(data);
  });
  
  ipcMain.handle('workspace:load', async (_, id: string) => {
    return loadWorkspace(id);
  });
  
  ipcMain.handle('workspace:list', async () => {
    return listWorkspaces();
  });
  
  ipcMain.handle('workspace:delete', async (_, id: string) => {
    return deleteWorkspace(id);
  });
  
  ipcMain.handle('workspace:getLastId', async () => {
    return getLastWorkspaceId();
  });
};
```

### Step 4.2: Main Process - Settings Store

**File: `src/main/settings.ts`**
```typescript
import Store from 'electron-store';
import { ipcMain, safeStorage } from 'electron';
import type { AppSettings, IPCResponse } from '@shared/types';

// -----------------------------------------------------------------------------
// Store Configuration
// -----------------------------------------------------------------------------

interface StoreSchema {
  settings: Omit<AppSettings, 'apiKeys'>;
  encryptedApiKeys: {
    anthropic?: string;
    gemini?: string;
    openai?: string;
  };
}

const store = new Store<StoreSchema>({
  defaults: {
    settings: {
      theme: 'dark',
      autoSave: true,
      autoSaveInterval: 2000,
      defaultProvider: 'anthropic',
      recentWorkspaces: [],
    },
    encryptedApiKeys: {},
  },
});

// -----------------------------------------------------------------------------
// API Key Management (Encrypted)
// -----------------------------------------------------------------------------

const encryptApiKey = (key: string): string => {
  if (!safeStorage.isEncryptionAvailable()) {
    // Fallback for development - NOT secure in production
    return Buffer.from(key).toString('base64');
  }
  return safeStorage.encryptString(key).toString('base64');
};

const decryptApiKey = (encrypted: string): string => {
  if (!safeStorage.isEncryptionAvailable()) {
    return Buffer.from(encrypted, 'base64').toString('utf-8');
  }
  const buffer = Buffer.from(encrypted, 'base64');
  return safeStorage.decryptString(buffer);
};

export const setApiKey = (provider: string, key: string): void => {
  const encrypted = encryptApiKey(key);
  const keys = store.get('encryptedApiKeys');
  keys[provider as keyof typeof keys] = encrypted;
  store.set('encryptedApiKeys', keys);
};

export const getApiKey = (provider: string): string | null => {
  const keys = store.get('encryptedApiKeys');
  const encrypted = keys[provider as keyof typeof keys];
  if (!encrypted) return null;
  
  try {
    return decryptApiKey(encrypted);
  } catch {
    return null;
  }
};

export const hasApiKey = (provider: string): boolean => {
  const keys = store.get('encryptedApiKeys');
  return !!keys[provider as keyof typeof keys];
};

// -----------------------------------------------------------------------------
// Settings Management
// -----------------------------------------------------------------------------

export const getSettings = (): Omit<AppSettings, 'apiKeys'> => {
  return store.get('settings');
};

export const setSettings = (settings: Partial<Omit<AppSettings, 'apiKeys'>>): void => {
  const current = store.get('settings');
  store.set('settings', { ...current, ...settings });
};

export const addRecentWorkspace = (id: string): void => {
  const settings = store.get('settings');
  const recent = settings.recentWorkspaces.filter(r => r !== id);
  recent.unshift(id);
  settings.recentWorkspaces = recent.slice(0, 10); // Keep last 10
  store.set('settings', settings);
};

// -----------------------------------------------------------------------------
// IPC Registration
// -----------------------------------------------------------------------------

export const registerSettingsHandlers = (): void => {
  ipcMain.handle('settings:setApiKey', async (_, provider: string, key: string) => {
    try {
      setApiKey(provider, key);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
  
  ipcMain.handle('settings:getApiKey', async (_, provider: string) => {
    return getApiKey(provider);
  });
  
  ipcMain.handle('settings:hasApiKey', async (_, provider: string) => {
    return hasApiKey(provider);
  });
  
  ipcMain.handle('settings:get', async () => {
    return getSettings();
  });
  
  ipcMain.handle('settings:set', async (_, settings: Partial<Omit<AppSettings, 'apiKeys'>>) => {
    setSettings(settings);
    return { success: true };
  });
};
```

### Step 4.3: Preload Script Update

**File: `src/preload/index.ts`**
```typescript
import { contextBridge, ipcRenderer } from 'electron';
import type { WorkspaceData, LLMStreamOptions, Message } from '@shared/types';

// -----------------------------------------------------------------------------
// API Definition
// -----------------------------------------------------------------------------

const api = {
  // Workspace operations
  workspace: {
    save: (data: WorkspaceData) => ipcRenderer.invoke('workspace:save', data),
    load: (id: string) => ipcRenderer.invoke('workspace:load', id),
    list: () => ipcRenderer.invoke('workspace:list'),
    delete: (id: string) => ipcRenderer.invoke('workspace:delete', id),
    getLastId: () => ipcRenderer.invoke('workspace:getLastId'),
  },
  
  // Settings operations
  settings: {
    setApiKey: (provider: string, key: string) => 
      ipcRenderer.invoke('settings:setApiKey', provider, key),
    getApiKey: (provider: string) => 
      ipcRenderer.invoke('settings:getApiKey', provider),
    hasApiKey: (provider: string) => 
      ipcRenderer.invoke('settings:hasApiKey', provider),
    get: () => ipcRenderer.invoke('settings:get'),
    set: (settings: Record<string, unknown>) => 
      ipcRenderer.invoke('settings:set', settings),
  },
  
  // LLM operations
  llm: {
    stream: (provider: string, messages: Message[], options?: LLMStreamOptions) => {
      ipcRenderer.send('llm:stream', provider, messages, options);
    },
    cancel: () => {
      ipcRenderer.send('llm:cancel');
    },
    onChunk: (callback: (chunk: string) => void) => {
      const handler = (_: unknown, chunk: string) => callback(chunk);
      ipcRenderer.on('llm:chunk', handler);
      return () => ipcRenderer.removeListener('llm:chunk', handler);
    },
    onDone: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('llm:done', handler);
      return () => ipcRenderer.removeListener('llm:done', handler);
    },
    onError: (callback: (error: string) => void) => {
      const handler = (_: unknown, error: string) => callback(error);
      ipcRenderer.on('llm:error', handler);
      return () => ipcRenderer.removeListener('llm:error', handler);
    },
  },
};

// -----------------------------------------------------------------------------
// Expose to Renderer
// -----------------------------------------------------------------------------

contextBridge.exposeInMainWorld('api', api);

// Type declaration for renderer
declare global {
  interface Window {
    api: typeof api;
  }
}
```

---

*See IMPLEMENTATION_PART4.md for Chat Panel, Context Injection, and Project Grouping*
