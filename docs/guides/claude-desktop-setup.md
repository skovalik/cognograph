# Connecting Claude Desktop to Cognograph

This guide explains how to connect Claude Desktop to your Cognograph workspace using the Model Context Protocol (MCP).

## Prerequisites

1. Cognograph must be running
2. Claude Desktop installed

## Configuration

Add the following to your Claude Desktop configuration file:

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

### For Development (npm run mcp)

```json
{
  "mcpServers": {
    "cognograph": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "F:/Work Work/Aurochs/cognograph_02"
    }
  }
}
```

### For Built App

```json
{
  "mcpServers": {
    "cognograph": {
      "command": "path/to/Cognograph.exe",
      "args": ["--mcp-server"]
    }
  }
}
```

## Verification

1. Restart Claude Desktop after updating the configuration
2. Open a new conversation
3. Ask: "What resources are available from Cognograph?"
4. Claude should list your workspace, nodes, and edges

## Available Resources

Claude can read the following resources from your Cognograph workspace:

| Resource URI | Description |
|-------------|-------------|
| `cognograph://workspace` | Workspace overview (name, node/edge counts, viewport) |
| `cognograph://nodes` | List of all nodes with summaries |
| `cognograph://edges` | List of all connections |
| `cognograph://node/{id}` | Full details of a specific node |

## Available Tools

Claude can manipulate your workspace using these tools:

### Query Tools
- **get_context** - Get the context chain for a node
- **find_nodes** - Search for nodes by type, title, or tags
- **get_selection** - Get currently selected nodes
- **get_node_details** - Get full details of a specific node

### Mutation Tools
- **create_node** - Create a new node (conversation, project, note, task, artifact)
- **update_node** - Update properties of an existing node
- **delete_node** - Delete a node from the canvas
- **move_node** - Move a node to a new position
- **create_edge** - Create a connection between nodes
- **delete_edge** - Delete a connection
- **batch_operations** - Execute multiple operations as a single undo step

## Usage Examples

### Read workspace state
> "Show me my Cognograph workspace"

### Find nodes
> "Find all my incomplete tasks in Cognograph"

### Create content
> "Create a new note called 'Meeting Notes' in Cognograph"

### Update nodes
> "Mark the 'Review PR' task as done"

### Create connections
> "Connect the 'Research' note to the 'Implementation' conversation"

## Troubleshooting

### Claude doesn't see Cognograph
- Ensure Cognograph is running before starting Claude Desktop
- Check that the config file path is correct
- Verify the `cwd` path points to your Cognograph installation

### Tools don't work
- Make sure Cognograph has a workspace loaded
- Check the Cognograph console for error messages
- Restart both Cognograph and Claude Desktop

### Changes don't appear
- Changes made by Claude are reflected immediately in Cognograph
- Use Ctrl+S to ensure changes are saved
- Check the Cognograph console for any sync errors

## Architecture

The MCP integration works as follows:

1. Claude Desktop connects to Cognograph via stdio transport
2. Cognograph's main process runs the MCP server
3. Workspace state is synced from the renderer (React) to main process
4. Tool execution requests are forwarded to the renderer for processing
5. Results are sent back to Claude Desktop

This ensures Claude always works with the current workspace state and all changes are properly handled by Cognograph's existing state management.
