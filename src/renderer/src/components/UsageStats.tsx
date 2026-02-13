import { useSessionStatsStore } from '../stores/sessionStatsStore'
import { formatCost, formatTokenCount } from '../utils/tokenEstimator'
import { toast } from 'react-hot-toast'

export function UsageStats(): JSX.Element {
  const totalInputTokens = useSessionStatsStore((s) => s.totalInputTokens)
  const totalOutputTokens = useSessionStatsStore((s) => s.totalOutputTokens)
  const totalCostUSD = useSessionStatsStore((s) => s.totalCostUSD)
  const totalRequests = useSessionStatsStore((s) => s.totalRequests)
  const byModel = useSessionStatsStore((s) => s.byModel)

  const modelEntries = Object.values(byModel)

  const handleReset = () => {
    useSessionStatsStore.getState().resetStats()
    toast.success('Session stats reset')
  }

  if (totalRequests === 0) {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold gui-text">Usage</h3>
        <p className="text-sm" style={{ color: 'var(--gui-text-muted)' }}>
          No usage data yet. Stats will appear here after your first API call this session.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold gui-text">Usage</h3>

      {/* Session Totals */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium gui-text-secondary">Session Totals</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded gui-surface-raised">
            <div className="text-xs" style={{ color: 'var(--gui-text-muted)' }}>Requests</div>
            <div className="text-lg font-semibold gui-text">{totalRequests}</div>
          </div>
          <div className="p-3 rounded gui-surface-raised">
            <div className="text-xs" style={{ color: 'var(--gui-text-muted)' }}>Total Cost</div>
            <div className="text-lg font-semibold gui-text">{formatCost(totalCostUSD)}</div>
          </div>
          <div className="p-3 rounded gui-surface-raised">
            <div className="text-xs" style={{ color: 'var(--gui-text-muted)' }}>Input Tokens</div>
            <div className="text-lg font-semibold gui-text">{formatTokenCount(totalInputTokens)}</div>
          </div>
          <div className="p-3 rounded gui-surface-raised">
            <div className="text-xs" style={{ color: 'var(--gui-text-muted)' }}>Output Tokens</div>
            <div className="text-lg font-semibold gui-text">{formatTokenCount(totalOutputTokens)}</div>
          </div>
        </div>
      </div>

      {/* By Model Breakdown */}
      {modelEntries.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium gui-text-secondary">By Model</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ color: 'var(--gui-text-muted)' }}>
                  <th className="pb-2 font-medium">Provider</th>
                  <th className="pb-2 font-medium">Model</th>
                  <th className="pb-2 font-medium text-right">Reqs</th>
                  <th className="pb-2 font-medium text-right">In</th>
                  <th className="pb-2 font-medium text-right">Out</th>
                  <th className="pb-2 font-medium text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {modelEntries.map((entry) => (
                  <tr key={`${entry.provider}:${entry.model}`} className="gui-text border-t gui-border">
                    <td className="py-1.5 capitalize">{entry.provider}</td>
                    <td className="py-1.5 font-mono text-xs">{entry.model}</td>
                    <td className="py-1.5 text-right">{entry.requestCount}</td>
                    <td className="py-1.5 text-right">{formatTokenCount(entry.inputTokens)}</td>
                    <td className="py-1.5 text-right">{formatTokenCount(entry.outputTokens)}</td>
                    <td className="py-1.5 text-right">{formatCost(entry.costUSD)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reset Button */}
      <div className="pt-2 border-t gui-border">
        <button
          onClick={handleReset}
          className="gui-btn gui-btn-ghost text-sm"
          style={{ color: 'var(--gui-text-muted)' }}
        >
          Reset Session Stats
        </button>
      </div>
    </div>
  )
}
