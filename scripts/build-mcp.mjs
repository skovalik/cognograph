// Build the MCP CLI bundle. Called from the `build:mcp` npm script.
// Extracted from an inline `node -e "..."` to avoid script-shell quoting issues.
import { buildSync } from 'esbuild'

buildSync({
  entryPoints: ['src/main/mcp/cli.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/cognograph-mcp.cjs',
  external: ['fsevents', 'electron', 'electron-updater'],
  alias: {
    '@shared': './src/shared',
    '@plugins': './src/plugins',
  },
})
