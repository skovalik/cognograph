import React, { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, CheckCircle, XCircle, StopCircle, PauseCircle } from 'lucide-react'
import type { AgentRunSummary } from '@shared/types'
import { CountUp } from '../ui/react-bits'

interface AgentRunHistoryViewerProps {
  nodeId: string
  history: AgentRunSummary[]
}

/**
 * Agent Run History Viewer - Display past agent runs with stats
 *
 * Features:
 * - Sortable by time (newest/oldest)
 * - Pagination at 50 runs
 * - Expandable details (error messages, stop reason, tools used)
 * - Status badges with icons
 * - Token/cost display with CountUp animation
 */
export const AgentRunHistoryViewer: React.FC<AgentRunHistoryViewerProps> = ({
  history
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [sortNewest, setSortNewest] = useState(true)
  const [expandedRuns, setExpandedRuns] = useState<Set<number>>(new Set())
  const [currentPage, setCurrentPage] = useState(0)

  const pageSize = 50

  // Sort and paginate
  const sortedHistory = useMemo(() => {
    const sorted = [...history].sort((a, b) => {
      const timeA = new Date(a.startedAt).getTime()
      const timeB = new Date(b.startedAt).getTime()
      return sortNewest ? timeB - timeA : timeA - timeB
    })
    return sorted
  }, [history, sortNewest])

  const paginatedHistory = useMemo(() => {
    const start = currentPage * pageSize
    return sortedHistory.slice(start, start + pageSize)
  }, [sortedHistory, currentPage])

  const totalPages = Math.ceil(sortedHistory.length / pageSize)

  const toggleRunExpanded = (index: number) => {
    const newSet = new Set(expandedRuns)
    if (newSet.has(index)) {
      newSet.delete(index)
    } else {
      newSet.add(index)
    }
    setExpandedRuns(newSet)
  }

  const formatRelativeTime = (timestamp: string): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`

    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  const getStatusIcon = (status: AgentRunSummary['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-3 h-3 text-green-500" />
      case 'error':
        return <XCircle className="w-3 h-3 text-red-500" />
      case 'cancelled':
        return <StopCircle className="w-3 h-3 text-gray-500" />
      case 'paused':
        return <PauseCircle className="w-3 h-3 text-yellow-500" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: AgentRunSummary['status']) => {
    const baseClass = 'px-1.5 py-0.5 rounded-full text-[10px] font-medium'
    switch (status) {
      case 'completed':
        return <span className={`${baseClass} bg-green-500/20 text-green-400`}>✓ Completed</span>
      case 'error':
        return <span className={`${baseClass} bg-red-500/20 text-red-400`}>✗ Error</span>
      case 'cancelled':
        return <span className={`${baseClass} bg-gray-500/20 text-gray-400`}>⊗ Cancelled</span>
      case 'paused':
        return <span className={`${baseClass} bg-yellow-500/20 text-yellow-400`}>⏸ Paused</span>
      default:
        return null
    }
  }

  return (
    <div className="border rounded">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium gui-text-secondary hover:bg-gray-500/10 transition-colors"
      >
        <span>Run History ({history.length} runs)</span>
        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t">
          {/* Sort toggle */}
          <div className="p-2 border-b flex items-center justify-between">
            <button
              onClick={() => setSortNewest(!sortNewest)}
              className="text-xs gui-text-secondary hover:gui-text-primary transition-colors flex items-center gap-1"
            >
              {sortNewest ? 'Newest First' : 'Oldest First'}
              <ChevronDown className={`w-3 h-3 transition-transform ${sortNewest ? '' : 'rotate-180'}`} />
            </button>
          </div>

          {/* Runs list */}
          <div className="max-h-[250px] overflow-y-auto px-2 pb-2">
            {paginatedHistory.length > 0 ? (
              <div className="space-y-2">
                {paginatedHistory.map((run, index) => {
                  const isExpanded = expandedRuns.has(index)
                  const duration = run.endedAt
                    ? ((new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime()) / 1000).toFixed(1)
                    : 'Running...'

                  return (
                    <div key={index} className="border rounded p-2 bg-gray-500/5" role="article" aria-label={`Run from ${run.startedAt}`}>
                      {/* Line 1: Time + Status */}
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs gui-text-secondary">{formatRelativeTime(run.startedAt)}</span>
                        {getStatusBadge(run.status)}
                      </div>

                      {/* Line 2: Stats */}
                      <div className="flex items-center gap-3 text-[10px] gui-text-muted mb-1">
                        <span>
                          <CountUp value={run.inputTokens} duration={0.5} /> in / <CountUp value={run.outputTokens} duration={0.5} /> out
                        </span>
                        <span>
                          $<CountUp value={run.costUSD} decimals={4} duration={0.5} />
                        </span>
                      </div>

                      {/* Line 3: Duration */}
                      <div className="text-[10px] gui-text-muted mb-1">
                        Duration: {duration}s
                      </div>

                      {/* Line 4: Tools */}
                      <div className="text-[10px] gui-text-muted mb-1">
                        Tools: {run.toolsUsed && run.toolsUsed.length > 0 ? (
                          run.toolsUsed.length > 3 ? (
                            <button
                              onClick={() => toggleRunExpanded(index)}
                              className="text-blue-400 hover:underline"
                            >
                              {run.toolsUsed.length} tools {isExpanded ? '▲' : '▼'}
                            </button>
                          ) : (
                            run.toolsUsed.join(', ')
                          )
                        ) : (
                          'none'
                        )}
                      </div>

                      {/* Expandable details */}
                      {isExpanded && (
                        <div className="mt-2 pt-2 border-t text-xs">
                          {run.status === 'error' && run.errorMessage && (
                            <div className="p-2 rounded bg-red-500/10 border border-red-500/30 text-red-400 mb-2">
                              <p className="font-semibold mb-1">Error:</p>
                              <p className="text-[10px]">{run.errorMessage}</p>
                            </div>
                          )}
                          {run.status === 'completed' && run.stopReason && (
                            <div className="gui-text-secondary">
                              Stop reason: <span className="gui-text-primary">{run.stopReason}</span>
                            </div>
                          )}
                          {run.status === 'cancelled' && (
                            <div className="gui-text-secondary">Run cancelled by user</div>
                          )}
                          {run.toolsUsed && run.toolsUsed.length > 3 && (
                            <div className="mt-2">
                              <p className="gui-text-secondary mb-1">All tools used:</p>
                              <div className="flex flex-wrap gap-1">
                                {run.toolsUsed.map((tool, i) => (
                                  <span key={i} className="px-1.5 py-0.5 rounded bg-gray-500/20 text-[10px] gui-text-primary">
                                    {tool}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-[var(--text-muted)]">
                No runs yet. Click Run to start this agent.
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-2 py-2 border-t flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>
                Showing {currentPage * pageSize + 1}-{Math.min((currentPage + 1) * pageSize, sortedHistory.length)} of {sortedHistory.length}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                  className="px-2 py-1 rounded hover:bg-gray-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                  disabled={currentPage >= totalPages - 1}
                  className="px-2 py-1 rounded hover:bg-gray-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
