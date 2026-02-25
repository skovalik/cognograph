# IMPLEMENTATION - Part 2: Components

> Continuation of IMPLEMENTATION.md. Node components and UI elements.

---

## Step 2.3: Conversation Node Component

**File: `src/renderer/src/components/nodes/ConversationNode.tsx`**
```tsx
import { memo, useCallback } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import { MessageSquare, MoreHorizontal } from 'lucide-react';
import type { ConversationNodeData } from '@shared/types';
import { useWorkspaceStore } from '../../stores/workspaceStore';

interface ConversationNodeProps extends NodeProps {
  data: ConversationNodeData;
}

export const ConversationNode = memo(({ id, data, selected }: ConversationNodeProps) => {
  const openChat = useWorkspaceStore(state => state.openChat);
  
  const handleDoubleClick = useCallback(() => {
    openChat(id);
  }, [id, openChat]);
  
  const messageCount = data.messages.length;
  const lastMessage = data.messages[data.messages.length - 1];
  const preview = lastMessage?.content.slice(0, 100) || 'No messages yet';
  
  return (
    <>
      <NodeResizer 
        minWidth={200} 
        minHeight={100}
        isVisible={selected}
        lineClassName="border-blue-500"
        handleClassName="w-3 h-3 bg-blue-500 border-2 border-white rounded"
      />
      
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Left} id="left" />
      
      <div 
        className={`cognograph-node cognograph-node--conversation ${selected ? 'selected' : ''}`}
        onDoubleClick={handleDoubleClick}
      >
        <div className="cognograph-node__header">
          <MessageSquare className="cognograph-node__icon text-blue-500" />
          <span className="cognograph-node__title">{data.title}</span>
          <button className="p-1 hover:bg-gray-700 rounded">
            <MoreHorizontal className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        
        <div className="cognograph-node__body">
          <p className="line-clamp-2">{preview}</p>
        </div>
        
        <div className="cognograph-node__footer">
          <span>{messageCount} messages</span>
          <span className="capitalize">{data.provider}</span>
        </div>
      </div>
      
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Right} id="right" />
    </>
  );
});

ConversationNode.displayName = 'ConversationNode';
```

---

## Step 2.4: Project Node Component

**File: `src/renderer/src/components/nodes/ProjectNode.tsx`**
```tsx
import { memo, useCallback } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import { Folder, ChevronDown, ChevronRight, MoreHorizontal } from 'lucide-react';
import type { ProjectNodeData } from '@shared/types';
import { useWorkspaceStore } from '../../stores/workspaceStore';

interface ProjectNodeProps extends NodeProps {
  data: ProjectNodeData;
}

export const ProjectNode = memo(({ id, data, selected }: ProjectNodeProps) => {
  const updateNode = useWorkspaceStore(state => state.updateNode);
  
  const toggleCollapse = useCallback(() => {
    updateNode(id, { collapsed: !data.collapsed });
  }, [id, data.collapsed, updateNode]);
  
  const childCount = data.childNodeIds.length;
  
  return (
    <>
      <NodeResizer 
        minWidth={300} 
        minHeight={200}
        isVisible={selected}
        lineClassName="border-purple-500"
        handleClassName="w-3 h-3 bg-purple-500 border-2 border-white rounded"
      />
      
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Left} id="left" />
      
      <div 
        className={`cognograph-node cognograph-node--project ${selected ? 'selected' : ''}`}
        style={{ 
          minHeight: data.collapsed ? 80 : 200,
          backgroundColor: `${data.color}15`,
          borderColor: data.color,
        }}
      >
        <div className="cognograph-node__header">
          <button 
            onClick={toggleCollapse}
            className="p-0.5 hover:bg-gray-700 rounded"
          >
            {data.collapsed ? (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>
          <Folder className="cognograph-node__icon" style={{ color: data.color }} />
          <span className="cognograph-node__title">{data.title}</span>
          <button className="p-1 hover:bg-gray-700 rounded">
            <MoreHorizontal className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        
        {!data.collapsed && (
          <>
            <div className="cognograph-node__body flex-1">
              {data.description ? (
                <p className="line-clamp-3">{data.description}</p>
              ) : (
                <p className="text-gray-600 italic">No description</p>
              )}
              
              {/* Drop zone for child nodes */}
              <div className="mt-2 border-2 border-dashed border-gray-700 rounded-lg p-4 text-center">
                <p className="text-gray-600 text-xs">
                  {childCount > 0 
                    ? `${childCount} item${childCount !== 1 ? 's' : ''}`
                    : 'Drop nodes here to group'}
                </p>
              </div>
            </div>
            
            <div className="cognograph-node__footer">
              <span>{childCount} items</span>
            </div>
          </>
        )}
      </div>
      
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Right} id="right" />
    </>
  );
});

ProjectNode.displayName = 'ProjectNode';
```

---

## Step 2.5: Note Node Component

**File: `src/renderer/src/components/nodes/NoteNode.tsx`**
```tsx
import { memo } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import { FileText, MoreHorizontal } from 'lucide-react';
import type { NoteNodeData } from '@shared/types';

interface NoteNodeProps extends NodeProps {
  data: NoteNodeData;
}

export const NoteNode = memo(({ id, data, selected }: NoteNodeProps) => {
  const contentPreview = data.content.slice(0, 150) || 'Empty note';
  const wordCount = data.content.split(/\s+/).filter(Boolean).length;
  
  return (
    <>
      <NodeResizer 
        minWidth={200} 
        minHeight={120}
        isVisible={selected}
        lineClassName="border-amber-500"
        handleClassName="w-3 h-3 bg-amber-500 border-2 border-white rounded"
      />
      
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Left} id="left" />
      
      <div className={`cognograph-node cognograph-node--note ${selected ? 'selected' : ''}`}>
        <div className="cognograph-node__header">
          <FileText className="cognograph-node__icon text-amber-500" />
          <span className="cognograph-node__title">{data.title}</span>
          <button className="p-1 hover:bg-gray-700 rounded">
            <MoreHorizontal className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        
        <div className="cognograph-node__body flex-1">
          <p className="line-clamp-4 whitespace-pre-wrap">{contentPreview}</p>
        </div>
        
        <div className="cognograph-node__footer">
          <span>{wordCount} words</span>
        </div>
      </div>
      
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Right} id="right" />
    </>
  );
});

NoteNode.displayName = 'NoteNode';
```

---

## Step 2.6: Task Node Component

**File: `src/renderer/src/components/nodes/TaskNode.tsx`**
```tsx
import { memo, useCallback } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import { CheckSquare, Circle, Clock, CheckCircle2, MoreHorizontal } from 'lucide-react';
import type { TaskNodeData } from '@shared/types';
import { useWorkspaceStore } from '../../stores/workspaceStore';

interface TaskNodeProps extends NodeProps {
  data: TaskNodeData;
}

const statusIcons = {
  'todo': Circle,
  'in-progress': Clock,
  'done': CheckCircle2,
};

const statusColors = {
  'todo': 'text-gray-400',
  'in-progress': 'text-blue-400',
  'done': 'text-emerald-400',
};

const priorityColors = {
  'low': 'bg-gray-600',
  'medium': 'bg-amber-600',
  'high': 'bg-red-600',
};

export const TaskNode = memo(({ id, data, selected }: TaskNodeProps) => {
  const updateNode = useWorkspaceStore(state => state.updateNode);
  
  const cycleStatus = useCallback(() => {
    const statusOrder: TaskNodeData['status'][] = ['todo', 'in-progress', 'done'];
    const currentIndex = statusOrder.indexOf(data.status);
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];
    updateNode(id, { status: nextStatus });
  }, [id, data.status, updateNode]);
  
  const StatusIcon = statusIcons[data.status];
  
  return (
    <>
      <NodeResizer 
        minWidth={180} 
        minHeight={100}
        isVisible={selected}
        lineClassName="border-emerald-500"
        handleClassName="w-3 h-3 bg-emerald-500 border-2 border-white rounded"
      />
      
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Left} id="left" />
      
      <div className={`cognograph-node cognograph-node--task ${selected ? 'selected' : ''}`}>
        <div className="cognograph-node__header">
          <button 
            onClick={cycleStatus}
            className="p-0.5 hover:bg-gray-700 rounded transition-colors"
          >
            <StatusIcon className={`w-5 h-5 ${statusColors[data.status]}`} />
          </button>
          <span className={`cognograph-node__title ${data.status === 'done' ? 'line-through text-gray-500' : ''}`}>
            {data.title}
          </span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold ${priorityColors[data.priority]}`}>
            {data.priority}
          </span>
        </div>
        
        {data.description && (
          <div className="cognograph-node__body">
            <p className="line-clamp-2">{data.description}</p>
          </div>
        )}
        
        <div className="cognograph-node__footer">
          <span className="capitalize">{data.status.replace('-', ' ')}</span>
        </div>
      </div>
      
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Right} id="right" />
    </>
  );
});

TaskNode.displayName = 'TaskNode';
```

---

## Step 2.7: Node Index Export

**File: `src/renderer/src/components/nodes/index.ts`**
```typescript
export { ConversationNode } from './ConversationNode';
export { ProjectNode } from './ProjectNode';
export { NoteNode } from './NoteNode';
export { TaskNode } from './TaskNode';

import type { NodeTypes } from '@xyflow/react';
import { ConversationNode } from './ConversationNode';
import { ProjectNode } from './ProjectNode';
import { NoteNode } from './NoteNode';
import { TaskNode } from './TaskNode';

export const nodeTypes: NodeTypes = {
  conversation: ConversationNode,
  project: ProjectNode,
  note: NoteNode,
  task: TaskNode,
};
```

---

## Step 2.8: Toolbar Component

**File: `src/renderer/src/components/Toolbar.tsx`**
```tsx
import { useCallback } from 'react';
import { 
  MessageSquare, 
  Folder, 
  FileText, 
  CheckSquare,
  Undo2,
  Redo2,
  Save,
  FolderOpen,
  FilePlus,
  Search
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspaceStore';
import type { NodeData } from '@shared/types';

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  shortcut?: string;
}

const ToolbarButton = ({ icon, label, onClick, disabled, shortcut }: ToolbarButtonProps) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`
      flex items-center gap-2 px-3 py-2 rounded-lg text-sm
      transition-colors duration-150
      ${disabled 
        ? 'text-gray-600 cursor-not-allowed' 
        : 'text-gray-300 hover:bg-gray-700 hover:text-white'}
    `}
    title={shortcut ? `${label} (${shortcut})` : label}
  >
    {icon}
    <span className="hidden lg:inline">{label}</span>
  </button>
);

const ToolbarDivider = () => (
  <div className="w-px h-8 bg-gray-700 mx-1" />
);

export const Toolbar = () => {
  const addNode = useWorkspaceStore(state => state.addNode);
  const undo = useWorkspaceStore(state => state.undo);
  const redo = useWorkspaceStore(state => state.redo);
  const historyIndex = useWorkspaceStore(state => state.historyIndex);
  const historyLength = useWorkspaceStore(state => state.history.length);
  const isDirty = useWorkspaceStore(state => state.isDirty);
  const newWorkspace = useWorkspaceStore(state => state.newWorkspace);
  
  const handleAddNode = useCallback((type: NodeData['type']) => {
    // Add node in center of visible viewport
    // This will be improved to use actual viewport center
    const position = {
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
    };
    addNode(type, position);
  }, [addNode]);
  
  const handleSave = useCallback(async () => {
    // Will be implemented with IPC
    console.log('Save workspace');
  }, []);
  
  const handleOpen = useCallback(async () => {
    // Will be implemented with IPC
    console.log('Open workspace');
  }, []);
  
  return (
    <div className="absolute top-4 left-4 z-50 flex items-center gap-1 bg-gray-800/95 backdrop-blur-sm rounded-xl p-2 shadow-xl border border-gray-700">
      {/* File operations */}
      <ToolbarButton
        icon={<FilePlus className="w-4 h-4" />}
        label="New"
        onClick={newWorkspace}
        shortcut="Ctrl+N"
      />
      <ToolbarButton
        icon={<FolderOpen className="w-4 h-4" />}
        label="Open"
        onClick={handleOpen}
        shortcut="Ctrl+O"
      />
      <ToolbarButton
        icon={<Save className="w-4 h-4" />}
        label={isDirty ? 'Save*' : 'Save'}
        onClick={handleSave}
        shortcut="Ctrl+S"
      />
      
      <ToolbarDivider />
      
      {/* Add nodes */}
      <ToolbarButton
        icon={<MessageSquare className="w-4 h-4 text-blue-500" />}
        label="Conversation"
        onClick={() => handleAddNode('conversation')}
      />
      <ToolbarButton
        icon={<Folder className="w-4 h-4 text-purple-500" />}
        label="Project"
        onClick={() => handleAddNode('project')}
      />
      <ToolbarButton
        icon={<FileText className="w-4 h-4 text-amber-500" />}
        label="Note"
        onClick={() => handleAddNode('note')}
      />
      <ToolbarButton
        icon={<CheckSquare className="w-4 h-4 text-emerald-500" />}
        label="Task"
        onClick={() => handleAddNode('task')}
      />
      
      <ToolbarDivider />
      
      {/* History */}
      <ToolbarButton
        icon={<Undo2 className="w-4 h-4" />}
        label="Undo"
        onClick={undo}
        disabled={historyIndex < 0}
        shortcut="Ctrl+Z"
      />
      <ToolbarButton
        icon={<Redo2 className="w-4 h-4" />}
        label="Redo"
        onClick={redo}
        disabled={historyIndex >= historyLength - 1}
        shortcut="Ctrl+Shift+Z"
      />
      
      <ToolbarDivider />
      
      {/* Search */}
      <ToolbarButton
        icon={<Search className="w-4 h-4" />}
        label="Search"
        onClick={() => console.log('Search')}
        shortcut="Ctrl+K"
      />
    </div>
  );
};
```

### ✅ CHECKPOINT 3
Run `npm run dev`. You should see:
- A canvas with grid background
- Toolbar in top-left corner
- Ability to add nodes by clicking toolbar buttons
- Nodes render with correct colors and icons
- Nodes can be dragged
- Nodes can be connected with edges
- Selection works (click to select, shift+click for multi-select)
- Delete key removes selected items

If any of these don't work, debug before proceeding.

---

*See IMPLEMENTATION_PART3.md for Phases 3-9*
