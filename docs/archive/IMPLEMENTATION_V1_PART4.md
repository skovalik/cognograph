# IMPLEMENTATION - Part 4: Chat, Context, LLM Integration

---

## Phase 5: Chat Integration

### Step 5.1: LLM Service in Main Process

**File: `src/main/llm.ts`**
```typescript
import { ipcMain, BrowserWindow } from 'electron';
import Anthropic from '@anthropic-ai/sdk';
import type { Message, LLMStreamOptions } from '@shared/types';
import { getApiKey } from './settings';

// -----------------------------------------------------------------------------
// State
// -----------------------------------------------------------------------------

let currentAbortController: AbortController | null = null;

// -----------------------------------------------------------------------------
// Provider Clients
// -----------------------------------------------------------------------------

const getAnthropicClient = (): Anthropic | null => {
  const apiKey = getApiKey('anthropic');
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
};

// -----------------------------------------------------------------------------
// Stream Handler
// -----------------------------------------------------------------------------

const streamAnthropic = async (
  window: BrowserWindow,
  messages: Message[],
  options: LLMStreamOptions
): Promise<void> => {
  const client = getAnthropicClient();
  if (!client) {
    window.webContents.send('llm:error', 'Anthropic API key not configured');
    return;
  }
  
  currentAbortController = new AbortController();
  
  try {
    // Convert messages to Anthropic format
    const anthropicMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
    
    // Extract system message if present
    const systemMessage = messages.find(m => m.role === 'system');
    const systemPrompt = [
      options.systemPrompt,
      systemMessage?.content,
    ].filter(Boolean).join('\n\n');
    
    const stream = await client.messages.stream({
      model: options.model || 'claude-sonnet-4-20250514',
      max_tokens: options.maxTokens || 4096,
      system: systemPrompt || undefined,
      messages: anthropicMessages,
    }, {
      signal: currentAbortController.signal,
    });
    
    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          window.webContents.send('llm:chunk', event.delta.text);
        }
      }
    }
    
    window.webContents.send('llm:done');
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      window.webContents.send('llm:done'); // Cancelled, not an error
    } else {
      const message = error instanceof Error ? error.message : 'Unknown error';
      window.webContents.send('llm:error', message);
    }
  } finally {
    currentAbortController = null;
  }
};

// Add Gemini support
const streamGemini = async (
  window: BrowserWindow,
  messages: Message[],
  options: LLMStreamOptions
): Promise<void> => {
  // Placeholder - implement when @google/generative-ai is integrated
  window.webContents.send('llm:error', 'Gemini not yet implemented');
};

// -----------------------------------------------------------------------------
// IPC Registration
// -----------------------------------------------------------------------------

export const registerLLMHandlers = (): void => {
  ipcMain.on('llm:stream', async (event, provider: string, messages: Message[], options: LLMStreamOptions = {}) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    
    switch (provider) {
      case 'anthropic':
        await streamAnthropic(window, messages, options);
        break;
      case 'gemini':
        await streamGemini(window, messages, options);
        break;
      default:
        window.webContents.send('llm:error', `Unknown provider: ${provider}`);
    }
  });
  
  ipcMain.on('llm:cancel', () => {
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }
  });
};
```

### Step 5.2: Chat Panel Component

**File: `src/renderer/src/components/ChatPanel.tsx`**
```tsx
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Send, Square, Loader2, Link2, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useWorkspaceStore } from '../stores/workspaceStore';
import type { Message, ConversationNodeData } from '@shared/types';

// -----------------------------------------------------------------------------
// API Key Setup Modal
// -----------------------------------------------------------------------------

interface ApiKeyModalProps {
  provider: string;
  onSubmit: (key: string) => void;
  onClose: () => void;
}

const ApiKeyModal = ({ provider, onSubmit, onClose }: ApiKeyModalProps) => {
  const [key, setKey] = useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (key.trim()) {
      onSubmit(key.trim());
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-[400px] shadow-2xl">
        <h3 className="text-lg font-semibold text-gray-100 mb-2">
          Enter {provider === 'anthropic' ? 'Anthropic' : provider} API Key
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          Your API key is stored securely on your device and never sent to our servers.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-ant-..."
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200 mb-4 focus:outline-none focus:border-blue-500"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!key.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm disabled:opacity-50"
            >
              Save Key
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Message Component
// -----------------------------------------------------------------------------

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble = ({ message }: MessageBubbleProps) => {
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gray-800 text-gray-200'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const language = match ? match[1] : '';
                  
                  if (!inline && language) {
                    return (
                      <div className="relative group">
                        <button
                          onClick={() => navigator.clipboard.writeText(String(children))}
                          className="absolute top-2 right-2 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Copy
                        </button>
                        <SyntaxHighlighter
                          style={oneDark}
                          language={language}
                          PreTag="div"
                          {...props}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      </div>
                    );
                  }
                  
                  return (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        
        {message.contextSources && message.contextSources.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Link2 className="w-3 h-3" />
              Context from: {message.contextSources.map(s => s.title).join(', ')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Context Indicator
// -----------------------------------------------------------------------------

interface ContextIndicatorProps {
  nodeId: string;
}

const ContextIndicator = ({ nodeId }: ContextIndicatorProps) => {
  const getConnectedNodes = useWorkspaceStore(state => state.getConnectedNodes);
  const connectedNodes = useMemo(() => getConnectedNodes(nodeId), [nodeId, getConnectedNodes]);
  
  if (connectedNodes.length === 0) return null;
  
  return (
    <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700 text-xs">
      <span className="flex items-center gap-2 text-gray-400">
        <Link2 className="w-3 h-3" />
        Using context from: 
        <span className="text-gray-300">
          {connectedNodes.map(n => n.data.title).join(', ')}
        </span>
      </span>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Main Chat Panel
// -----------------------------------------------------------------------------

export const ChatPanel = () => {
  const activeChatNodeId = useWorkspaceStore(state => state.activeChatNodeId);
  const nodes = useWorkspaceStore(state => state.nodes);
  const addMessage = useWorkspaceStore(state => state.addMessage);
  const closeChat = useWorkspaceStore(state => state.closeChat);
  const getContextForNode = useWorkspaceStore(state => state.getContextForNode);
  
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Get current conversation node
  const conversationNode = useMemo(() => {
    if (!activeChatNodeId) return null;
    const node = nodes.find(n => n.id === activeChatNodeId);
    if (!node || node.data.type !== 'conversation') return null;
    return node;
  }, [activeChatNodeId, nodes]);
  
  const data = conversationNode?.data as ConversationNodeData | undefined;
  
  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data?.messages, streamingContent]);
  
  // Focus input when panel opens
  useEffect(() => {
    if (activeChatNodeId) {
      inputRef.current?.focus();
    }
  }, [activeChatNodeId]);
  
  // Set up stream listeners
  useEffect(() => {
    const unsubChunk = window.api.llm.onChunk((chunk) => {
      setStreamingContent(prev => prev + chunk);
    });
    
    const unsubDone = window.api.llm.onDone(() => {
      setIsStreaming(false);
      if (streamingContent && activeChatNodeId) {
        addMessage(activeChatNodeId, 'assistant', streamingContent);
      }
      setStreamingContent('');
    });
    
    const unsubError = window.api.llm.onError((err) => {
      setIsStreaming(false);
      setError(err);
      setStreamingContent('');
    });
    
    return () => {
      unsubChunk();
      unsubDone();
      unsubError();
    };
  }, [activeChatNodeId, streamingContent, addMessage]);
  
  // Check API key on mount
  useEffect(() => {
    const checkApiKey = async () => {
      if (!data) return;
      const hasKey = await window.api.settings.hasApiKey(data.provider);
      if (!hasKey) {
        setShowApiKeyModal(true);
      }
    };
    checkApiKey();
  }, [data?.provider]);
  
  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming || !activeChatNodeId || !data) return;
    
    const hasKey = await window.api.settings.hasApiKey(data.provider);
    if (!hasKey) {
      setShowApiKeyModal(true);
      return;
    }
    
    const userMessage = input.trim();
    setInput('');
    setError(null);
    
    // Add user message
    addMessage(activeChatNodeId, 'user', userMessage);
    
    // Build messages array for API
    const context = getContextForNode(activeChatNodeId);
    const messages: Message[] = [
      ...(context ? [{ 
        id: 'context', 
        role: 'system' as const, 
        content: `Here is relevant context:\n\n${context}`,
        timestamp: Date.now()
      }] : []),
      ...data.messages,
      { id: 'new', role: 'user' as const, content: userMessage, timestamp: Date.now() },
    ];
    
    // Start streaming
    setIsStreaming(true);
    setStreamingContent('');
    window.api.llm.stream(data.provider, messages, {});
  }, [input, isStreaming, activeChatNodeId, data, addMessage, getContextForNode]);
  
  const handleCancel = useCallback(() => {
    window.api.llm.cancel();
  }, []);
  
  const handleApiKeySubmit = useCallback(async (key: string) => {
    if (!data) return;
    await window.api.settings.setApiKey(data.provider, key);
    setShowApiKeyModal(false);
  }, [data?.provider]);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);
  
  if (!conversationNode || !data) {
    return null;
  }
  
  return (
    <>
      <div className="w-[500px] bg-gray-900 border-l border-gray-700 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <div>
            <h2 className="font-semibold text-gray-200">{data.title}</h2>
            <p className="text-xs text-gray-500 capitalize">{data.provider}</p>
          </div>
          <button 
            onClick={closeChat}
            className="p-2 hover:bg-gray-700 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        
        {/* Context Indicator */}
        <ContextIndicator nodeId={activeChatNodeId!} />
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {data.messages.length === 0 && !streamingContent && (
            <div className="text-center text-gray-500 mt-8">
              <p>Start a conversation</p>
              <p className="text-sm mt-1">Connected nodes will provide context</p>
            </div>
          )}
          
          {data.messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          
          {streamingContent && (
            <MessageBubble 
              message={{ 
                id: 'streaming', 
                role: 'assistant', 
                content: streamingContent,
                timestamp: Date.now()
              }} 
            />
          )}
          
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm p-3 bg-red-900/20 rounded-lg">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message... (Enter to send)"
              rows={1}
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500"
              disabled={isStreaming}
            />
            {isStreaming ? (
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg"
              >
                <Square className="w-5 h-5 text-white" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg disabled:opacity-50"
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            )}
          </div>
        </div>
      </div>
      
      {showApiKeyModal && (
        <ApiKeyModal
          provider={data.provider}
          onSubmit={handleApiKeySubmit}
          onClose={() => setShowApiKeyModal(false)}
        />
      )}
    </>
  );
};
```

### ✅ CHECKPOINT 5
Run `npm run dev`. You should be able to:
- Double-click a conversation node to open chat
- Enter API key when prompted
- Send messages and receive streaming responses
- See context indicator when nodes are connected
- Cancel streaming with the stop button
- See markdown rendered in responses

---

## Phase 6: Context Injection

Context injection is already implemented in the Chat Panel above. The key function is in the store:

```typescript
getContextForNode: (nodeId) => {
  const connectedNodes = get().getConnectedNodes(nodeId);
  const contextParts: string[] = [];
  
  connectedNodes.forEach(node => {
    switch (node.data.type) {
      case 'note':
        contextParts.push(`[Note: ${node.data.title}]\n${node.data.content}`);
        break;
      case 'project':
        contextParts.push(`[Project: ${node.data.title}]\n${node.data.description}`);
        break;
      case 'conversation':
        const recentMessages = node.data.messages.slice(-5);
        if (recentMessages.length > 0) {
          const msgText = recentMessages
            .map(m => `${m.role}: ${m.content}`)
            .join('\n');
          contextParts.push(`[Related Conversation: ${node.data.title}]\n${msgText}`);
        }
        break;
    }
  });
  
  return contextParts.join('\n\n---\n\n');
}
```

This is called when sending a message:

```typescript
const context = getContextForNode(activeChatNodeId);
const messages: Message[] = [
  ...(context ? [{ 
    id: 'context', 
    role: 'system' as const, 
    content: `Here is relevant context:\n\n${context}`,
    timestamp: Date.now()
  }] : []),
  ...data.messages,
  { id: 'new', role: 'user', content: userMessage, timestamp: Date.now() },
];
```

---

*See IMPLEMENTATION_PART5.md for Project Grouping, App.tsx, and Final Assembly*
