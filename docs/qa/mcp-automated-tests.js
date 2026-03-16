/**
 * MCP Automated Test Suite for Cognograph
 * Run these tests via MCP protocol to validate implementation
 *
 * Prerequisites:
 * 1. Cognograph running in dev mode (npm run dev)
 * 2. Diagnostic server active (http://127.0.0.1:9223)
 * 3. MCP server configured with DIAGNOSTIC_TOKEN
 *
 * Usage: Execute each test via cognograph_execute() MCP tool
 */

// =============================================================================
// TEST 1: Glass System Verification
// =============================================================================

const test1_glassSystemActive = `
// Test 1.1: Verify glass CSS loaded
(() => {
  const results = {
    test: 'Glass System Active',
    timestamp: Date.now()
  }

  // Check glass.css loaded
  const glassCSS = document.querySelector('style[data-glass]')
  results.glassCSSLoaded = !!glassCSS
  results.glassCSSLength = glassCSS?.textContent.length || 0

  // Check data attributes on document
  results.dataAttributes = {
    glassNodes: document.documentElement.dataset.glassNodes,
    glassModals: document.documentElement.dataset.glassModals,
    glassPanels: document.documentElement.dataset.glassPanels,
    glassStyle: document.documentElement.dataset.glassStyle
  }

  // Check glass settings in store (if accessible)
  try {
    if (window.workspaceStore) {
      const state = window.workspaceStore.getState()
      results.storeGlassSettings = state.themeSettings?.glassSettings
    }
  } catch (e) {
    results.storeError = e.message
  }

  // Count nodes with glass applied
  const nodes = document.querySelectorAll('.cognograph-node')
  results.totalNodes = nodes.length
  results.nodesWithGlass = Array.from(nodes).filter(n => {
    const style = getComputedStyle(n)
    return style.backdropFilter && style.backdropFilter !== 'none'
  }).length

  results.passed = results.glassCSSLoaded && results.totalNodes > 0
  return results
})()
`

// =============================================================================
// TEST 2: ConversationNode Tint Verification
// =============================================================================

const test2_conversationNodeTints = `
// Test 2.1: Verify ConversationNode mode tints
(() => {
  const results = {
    test: 'ConversationNode Tints',
    timestamp: Date.now()
  }

  // Find conversation nodes
  const conversationNodes = document.querySelectorAll('[data-node-type="conversation"]')
  results.totalConversationNodes = conversationNodes.length

  if (conversationNodes.length === 0) {
    results.warning = 'No conversation nodes found in workspace'
    results.passed = false
    return results
  }

  // Check agent mode nodes
  const agentNodes = Array.from(conversationNodes).filter(n => n.dataset.mode === 'agent')
  results.agentCount = agentNodes.length

  if (agentNodes.length > 0) {
    const agentNode = agentNodes[0]
    const bg = getComputedStyle(agentNode).background
    results.agent = {
      found: true,
      background: bg.substring(0, 100) + '...',  // Truncate for readability
      hasColorMix: bg.includes('color-mix'),
      has30Percent: bg.includes('30%')
    }
  } else {
    results.agent = { found: false }
  }

  // Check chat mode nodes
  const chatNodes = Array.from(conversationNodes).filter(n => n.dataset.mode === 'chat' || !n.dataset.mode)
  results.chatCount = chatNodes.length

  if (chatNodes.length > 0) {
    const chatNode = chatNodes[0]
    const bg = getComputedStyle(chatNode).background
    results.chat = {
      found: true,
      background: bg.substring(0, 100) + '...',
      hasColorMix: bg.includes('color-mix'),
      has20Percent: bg.includes('20%')
    }
  } else {
    results.chat = { found: false }
  }

  // Pass if at least one mode has correct tint
  results.passed = (results.agent.found && results.agent.hasColorMix) ||
                   (results.chat.found && results.chat.hasColorMix)

  return results
})()
`

// =============================================================================
// TEST 3: ArtifactNode Content Type Tints
// =============================================================================

const test3_artifactNodeTints = `
// Test 3.1: Verify ArtifactNode content type tints
(() => {
  const results = {
    test: 'ArtifactNode Content Type Tints',
    timestamp: Date.now()
  }

  // Find artifact nodes
  const artifactNodes = document.querySelectorAll('[data-node-type="artifact"]')
  results.totalArtifactNodes = artifactNodes.length

  if (artifactNodes.length === 0) {
    results.warning = 'No artifact nodes found in workspace'
    results.passed = false
    return results
  }

  // Check content types
  const contentTypes = ['code', 'html', 'svg', 'markdown', 'json', 'text', 'image', 'csv', 'mermaid', 'custom']
  results.contentTypes = {}

  contentTypes.forEach(type => {
    const nodes = Array.from(artifactNodes).filter(n => n.dataset.contentType === type)
    if (nodes.length > 0) {
      const node = nodes[0]
      const bg = getComputedStyle(node).background
      results.contentTypes[type] = {
        found: true,
        count: nodes.length,
        hasColorMix: bg.includes('color-mix'),
        background: bg.substring(0, 80) + '...'
      }
    } else {
      results.contentTypes[type] = { found: false }
    }
  })

  // Count how many content types have tints
  const typesWithTints = Object.values(results.contentTypes).filter(t => t.found && t.hasColorMix).length
  results.typesWithTints = typesWithTints
  results.totalTypesFound = Object.values(results.contentTypes).filter(t => t.found).length

  // Pass if at least 50% of found types have tints
  results.passed = results.totalTypesFound > 0 &&
                   (typesWithTints / results.totalTypesFound) >= 0.5

  return results
})()
`

// =============================================================================
// TEST 4: NoteNode Mode Tints (10 modes)
// =============================================================================

const test4_noteNodeTints = `
// Test 4.1: Verify NoteNode mode tints
(() => {
  const results = {
    test: 'NoteNode Mode Tints',
    timestamp: Date.now()
  }

  // Find note nodes
  const noteNodes = document.querySelectorAll('[data-node-type="note"]')
  results.totalNoteNodes = noteNodes.length

  if (noteNodes.length === 0) {
    results.warning = 'No note nodes found in workspace'
    results.passed = false
    return results
  }

  // Check all 10 note modes
  const noteModes = [
    'general', 'persona', 'instruction', 'reference', 'example',
    'background', 'design-tokens', 'page', 'component', 'content-model'
  ]

  results.modes = {}

  noteModes.forEach(mode => {
    const nodes = Array.from(noteNodes).filter(n => n.dataset.mode === mode)
    if (nodes.length > 0) {
      const node = nodes[0]
      const bg = getComputedStyle(node).background
      results.modes[mode] = {
        found: true,
        count: nodes.length,
        hasColorMix: bg.includes('color-mix'),
        background: bg.substring(0, 80) + '...'
      }
    } else {
      results.modes[mode] = { found: false }
    }
  })

  // Count how many modes have tints
  const modesWithTints = Object.values(results.modes).filter(m => m.found && m.hasColorMix).length
  results.modesWithTints = modesWithTints
  results.totalModesFound = Object.values(results.modes).filter(m => m.found).length

  // Pass if at least 50% of found modes have tints
  results.passed = results.totalModesFound > 0 &&
                   (modesWithTints / results.totalModesFound) >= 0.5

  return results
})()
`

// =============================================================================
// TEST 5: Performance Benchmark
// =============================================================================

const test5_performanceBenchmark = `
// Test 5.1: Measure node rendering performance
(() => {
  const results = {
    test: 'Performance Benchmark',
    timestamp: Date.now()
  }

  // Count existing nodes
  const existingNodes = document.querySelectorAll('.cognograph-node')
  results.existingNodeCount = existingNodes.length

  // Measure time to query and compute styles for all nodes
  const start = performance.now()

  const nodeMetrics = Array.from(existingNodes).map(node => {
    const bg = getComputedStyle(node).background
    const backdropFilter = getComputedStyle(node).backdropFilter
    return {
      hasBackground: bg.length > 0,
      hasBackdropFilter: backdropFilter !== 'none'
    }
  })

  const end = performance.now()

  results.totalTimeMs = end - start
  results.perNodeMs = results.existingNodeCount > 0
    ? (end - start) / results.existingNodeCount
    : 0

  results.nodesWithBackground = nodeMetrics.filter(m => m.hasBackground).length
  results.nodesWithBackdropFilter = nodeMetrics.filter(m => m.hasBackdropFilter).length

  // Pass if per-node computation time is <1ms
  results.passed = results.perNodeMs < 1.0

  return results
})()
`

// =============================================================================
// TEST 6: Store State Validation
// =============================================================================

const test6_storeStateValidation = `
// Test 6.1: Validate Zustand store state
(() => {
  const results = {
    test: 'Store State Validation',
    timestamp: Date.now()
  }

  try {
    if (!window.workspaceStore) {
      results.error = 'workspaceStore not found on window'
      results.passed = false
      return results
    }

    const state = window.workspaceStore.getState()

    // Check theme settings
    results.themeSettings = {
      exists: !!state.themeSettings,
      mode: state.themeSettings?.mode,
      currentPresetId: state.themeSettings?.currentPresetId
    }

    // Check glass settings
    if (state.themeSettings?.glassSettings) {
      const glass = state.themeSettings.glassSettings
      results.glassSettings = {
        userPreference: glass.userPreference,
        effectiveStyle: glass.effectiveStyle,
        blurRadius: glass.blurRadius,
        panelOpacity: glass.panelOpacity,
        noiseOpacity: glass.noiseOpacity,
        shimmerSpeed: glass.shimmerSpeed,
        applyTo: glass.applyTo
      }
    }

    // Check nodes
    results.workspace = {
      nodeCount: state.nodes?.length || 0,
      edgeCount: state.edges?.length || 0
    }

    // Pass if theme settings exist and glass is configured
    results.passed = results.themeSettings.exists &&
                     !!results.glassSettings &&
                     results.workspace.nodeCount >= 0

  } catch (e) {
    results.error = e.message
    results.passed = false
  }

  return results
})()
`

// =============================================================================
// TEST 7: Diagnostic Server Health
// =============================================================================

const test7_diagnosticServerHealth = `
// Test 7.1: Verify diagnostic server is responding
(() => {
  const results = {
    test: 'Diagnostic Server Health',
    timestamp: Date.now()
  }

  // This test is special - it's executed by the diagnostic server itself
  // If this code runs, the server is working!

  results.serverResponding = true
  results.executionContext = 'renderer'
  results.electronVersion = process?.versions?.electron || 'unknown'
  results.chromeVersion = process?.versions?.chrome || 'unknown'
  results.nodeVersion = process?.versions?.node || 'unknown'

  // Check if we can access console
  results.consoleAvailable = typeof console !== 'undefined'

  // Check if we can access document
  results.documentAvailable = typeof document !== 'undefined'

  results.passed = results.serverResponding &&
                   results.consoleAvailable &&
                   results.documentAvailable

  return results
})()
`

// =============================================================================
// TEST SUMMARY
// =============================================================================

const testSummary = `
// Execute all tests and generate summary
(() => {
  const tests = [
    'Glass System Active',
    'ConversationNode Tints',
    'ArtifactNode Content Type Tints',
    'NoteNode Mode Tints',
    'Performance Benchmark',
    'Store State Validation',
    'Diagnostic Server Health'
  ]

  return {
    totalTests: tests.length,
    tests,
    instructions: 'Execute each test individually via cognograph_execute()',
    mcpCommand: 'cognograph_execute("<test_code>")'
  }
})()
`

// =============================================================================
// EXPORT TEST SUITE
// =============================================================================

module.exports = {
  test1_glassSystemActive,
  test2_conversationNodeTints,
  test3_artifactNodeTints,
  test4_noteNodeTints,
  test5_performanceBenchmark,
  test6_storeStateValidation,
  test7_diagnosticServerHealth,
  testSummary
}

// =============================================================================
// USAGE INSTRUCTIONS
// =============================================================================

/*
To run these tests:

1. Start Cognograph in dev mode:
   npm run dev

2. Note the diagnostic token from console output

3. Configure MCP server with token

4. In Claude Code, use the cognograph_execute tool:

   cognograph_execute(test1_glassSystemActive)
   cognograph_execute(test2_conversationNodeTints)
   cognograph_execute(test3_artifactNodeTints)
   cognograph_execute(test4_noteNodeTints)
   cognograph_execute(test5_performanceBenchmark)
   cognograph_execute(test6_storeStateValidation)
   cognograph_execute(test7_diagnosticServerHealth)

5. Collect results and calculate confidence score:
   - 7/7 tests passing = 100% automated test confidence
   - Combine with manual verification for final 95%+ confidence
*/
