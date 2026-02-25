// MCP Tool Definitions - Phase 14
// Defines the schema for each tool exposed by the MCP server

export const TOOL_DEFINITIONS = [
  {
    name: 'get_todos',
    description:
      'Get task nodes from the workspace, optionally filtered by status, priority, tags, or project.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['todo', 'in-progress', 'done'],
          description: 'Filter by task status'
        },
        priority: {
          type: 'string',
          enum: ['none', 'low', 'medium', 'high'],
          description: 'Filter by priority level'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by tags (any match)'
        },
        projectId: {
          type: 'string',
          description: 'Filter by parent project node ID'
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default: 50)'
        }
      }
    }
  },
  {
    name: 'get_node',
    description: 'Get full details of a single node by its ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The node ID' }
      },
      required: ['id']
    }
  },
  {
    name: 'search_nodes',
    description:
      'Search for nodes by title or content text. Case-insensitive substring match.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search text to match against title and content'
        },
        types: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['conversation', 'project', 'note', 'task', 'artifact', 'text', 'workspace', 'orchestrator']
          },
          description: 'Filter to specific node types'
        },
        limit: {
          type: 'number',
          description: 'Max results (default: 20)'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'get_context_chain',
    description:
      'Get the context chain for a node by traversing incoming edges up to a given depth. Returns the nodes that would provide context.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'Starting node ID' },
        depth: {
          type: 'number',
          description: 'Max traversal depth (default: 2)'
        }
      },
      required: ['nodeId']
    }
  },
  {
    name: 'update_node',
    description:
      'Update properties of an existing node. Only allowed fields for the node type are applied.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Node ID to update' },
        changes: {
          type: 'object',
          description:
            'Fields to update. Task: title, description, status, priority, complexity, tags, color. Note: title, content, tags, color. Conversation: title, tags, color. Text: content, color. Project: title, description, color.',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            content: { type: 'string' },
            status: { type: 'string', enum: ['todo', 'in-progress', 'done'] },
            priority: { type: 'string', enum: ['none', 'low', 'medium', 'high'] },
            complexity: {
              type: 'string',
              enum: ['trivial', 'simple', 'moderate', 'complex', 'very-complex']
            },
            tags: { type: 'array', items: { type: 'string' } },
            color: { type: 'string' }
          }
        }
      },
      required: ['id', 'changes']
    }
  },
  {
    name: 'create_node',
    description:
      'Create a new node in the workspace. Optionally link it to an existing node.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['task', 'note', 'conversation', 'text', 'project', 'artifact', 'orchestrator'],
          description: 'Node type to create'
        },
        data: {
          type: 'object',
          description:
            'Node data. Task: title, description, status, priority, tags. Note: title, content, tags. Conversation: title. Text: content. Project: title, description.'
        },
        position: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' }
          },
          description: 'Canvas position (default: {x: 0, y: 0})'
        },
        linkFrom: {
          type: 'string',
          description: 'Node ID to create an edge FROM (source→new node)'
        },
        parentId: {
          type: 'string',
          description: 'Project node ID to set as parent'
        }
      },
      required: ['type', 'data']
    }
  },
  {
    name: 'add_comment',
    description:
      'Append a timestamped comment to a node\'s description (tasks) or content (notes). Creates a clearly delimited comment block.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Node ID to comment on' },
        text: { type: 'string', description: 'Comment text to append' }
      },
      required: ['id', 'text']
    }
  },
  {
    name: 'link_nodes',
    description: 'Create an edge (connection) between two nodes.',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Source node ID' },
        target: { type: 'string', description: 'Target node ID' },
        label: { type: 'string', description: 'Optional edge label' },
        weight: {
          type: 'number',
          description: 'Edge weight 1-10 (default: 5)'
        }
      },
      required: ['source', 'target']
    }
  },
  {
    name: 'unlink_nodes',
    description:
      'Remove the edge between two nodes. Finds and deletes the edge connecting source to target.',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Source node ID' },
        target: { type: 'string', description: 'Target node ID' }
      },
      required: ['source', 'target']
    }
  },
  {
    name: 'cognograph_tokens_get',
    description:
      'Returns structured design tokens from the workspace. Searches for nodes with noteMode "design-tokens" or nodes tagged "design-system", "tokens", or "ds". Returns token data in the requested format.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: {
          type: 'string',
          description: 'Specific node ID to get tokens from. If omitted, discovers all token nodes.'
        },
        tag: {
          type: 'string',
          description: 'Filter token nodes by tag.'
        },
        format: {
          type: 'string',
          enum: ['raw', 'css', 'tailwind'],
          description:
            'Output format. "raw" returns the DesignTokenSet JSON (default). "css" returns CSS custom properties. "tailwind" returns Tailwind config extend format.'
        }
      }
    }
  },
  {
    name: 'cognograph_site_get_pages',
    description:
      'Returns all page-mode Note nodes and their component composition, forming the site information architecture. Supports filtering by status and pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        includeComponents: {
          type: 'boolean',
          description: 'Include component lists for each page (default: true)'
        },
        includeProps: {
          type: 'boolean',
          description: 'Include prop definitions for each component (default: false)'
        },
        status: {
          type: 'string',
          enum: ['all', 'planned', 'wireframed', 'designed', 'built', 'live'],
          description: 'Filter by page status (default: all)'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of pages to return. Returns all if omitted.'
        },
        offset: {
          type: 'number',
          description: 'Skip this many pages before returning results. Use with limit for pagination.'
        }
      }
    }
  },
  {
    name: 'cognograph_site_get_components',
    description:
      'Returns the full specification for a single page, including all component details, props, design tokens, and linked code artifacts. Look up by route or node ID.',
    inputSchema: {
      type: 'object',
      properties: {
        route: {
          type: 'string',
          description: 'Page route to look up, e.g. "/about"'
        },
        nodeId: {
          type: 'string',
          description: 'Or specify by node ID'
        }
      }
    }
  },
  {
    name: 'cognograph_site_get_sitemap',
    description:
      'Update the build status of a page node. Validates that the target node is a page-mode Note.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: {
          type: 'string',
          description: 'Page node ID to update'
        },
        status: {
          type: 'string',
          enum: ['planned', 'wireframed', 'designed', 'built', 'live'],
          description: 'New build status for the page'
        }
      },
      required: ['nodeId', 'status']
    }
  },
  {
    name: 'cognograph_web_get_content_models',
    description:
      'Returns all content-model Note nodes in the workspace. Each contains WordPress CPT definitions with ACF field groups, taxonomies, and GraphQL names.',
    inputSchema: {
      type: 'object',
      properties: {
        postType: {
          type: 'string',
          description: 'Filter by specific post type slug (e.g., "project", "testimonial")'
        }
      }
    }
  },
  {
    name: 'cognograph_web_get_wp_config',
    description:
      'Returns WordPress connection configuration from the workspace. Returns site URL, endpoints, auth method, and environment. NEVER returns credential values.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_initial_context',
    description:
      'Get the full canvas context for a node, including all connected nodes via BFS traversal. Use this at the start of a session to understand the workspace topology.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: {
          type: 'string',
          description:
            'The node ID to get context for. If not provided, uses the COGNOGRAPH_NODE_ID env var.'
        }
      }
    }
  }
]
