/**
 * CostDashboard Component (Phase 5: Graph Intelligence)
 *
 * A right-side Sheet displaying cost tracking information:
 * - Session total cost
 * - Cost breakdown by category (horizontal bars)
 * - Budget progress bar with daily limit
 * - Recent cost entries
 * - Export and budget configuration
 */

import { memo, useMemo } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet'
import { Progress } from '../ui/progress'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { ScrollArea } from '../ui/scroll-area'
import { Separator } from '../ui/separator'
import { DollarSign, TrendingUp, AlertTriangle } from 'lucide-react'
import { useGraphIntelligenceStore } from '../../stores/graphIntelligenceStore'
import { useSessionStatsStore } from '../../stores/sessionStatsStore'
import type { CostSnapshot } from '@shared/types/bridge'

// =============================================================================
// Sub-components
// =============================================================================

function CostBar({
  label,
  amount,
  maxAmount,
  color = 'var(--accent-primary, #3b82f6)',
}: {
  label: string
  amount: number
  maxAmount: number
  color?: string
}): JSX.Element {
  const percentage = maxAmount > 0 ? (amount / maxAmount) * 100 : 0

  return (
    <div className="flex items-center gap-2">
      <span
        className="text-xs w-[120px] truncate"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </span>
      <div
        className="flex-1 h-2 rounded-full overflow-hidden"
        style={{ backgroundColor: 'var(--border-default)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(100, percentage)}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <span
        className="text-xs font-mono w-[60px] text-right"
        style={{ color: 'var(--text-primary)' }}
      >
        ${amount.toFixed(3)}
      </span>
    </div>
  )
}

function RecentCostEntry({
  snapshot,
}: {
  snapshot: CostSnapshot
}): JSX.Element {
  const time = new Date(snapshot.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const totalCost =
    snapshot.orchestrationCostUSD + snapshot.ambientCostUSD

  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        <span
          className="text-[10px] font-mono"
          style={{ color: 'var(--text-muted)' }}
        >
          {time}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
          {snapshot.orchestrationCostUSD > 0
            ? 'Orchestration'
            : snapshot.ambientCostUSD > 0
              ? 'Ambient analysis'
              : 'Session'}
        </span>
      </div>
      <div className="text-right">
        <span
          className="text-xs font-mono"
          style={{ color: 'var(--text-primary)' }}
        >
          ${totalCost.toFixed(4)}
        </span>
        {snapshot.sessionTokens > 0 && (
          <span
            className="text-[10px] ml-1"
            style={{ color: 'var(--text-muted)' }}
          >
            ({snapshot.sessionTokens.toLocaleString()} tokens)
          </span>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

interface CostDashboardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function CostDashboardComponent({
  open,
  onOpenChange,
}: CostDashboardProps): JSX.Element {
  const costHistory = useGraphIntelligenceStore((s) => s.costHistory)
  const dailyBudgetUsed = useGraphIntelligenceStore((s) => s.dailyBudgetUsed)
  const dailyBudgetLimit = useGraphIntelligenceStore((s) => s.dailyBudgetLimit)
  const currentSessionCost = useGraphIntelligenceStore(
    (s) => s.currentSessionCost
  )
  const sessionStats = useSessionStatsStore((s) => ({
    totalCostUSD: s.totalCostUSD,
    totalInputTokens: s.totalInputTokens,
    totalOutputTokens: s.totalOutputTokens,
    totalRequests: s.totalRequests,
    byModel: s.byModel,
  }))

  // Compute cost categories
  const costCategories = useMemo(() => {
    const orchestrationCost = costHistory.reduce(
      (sum, s) => sum + s.orchestrationCostUSD,
      0
    )
    const ambientCost = costHistory.reduce(
      (sum, s) => sum + s.ambientCostUSD,
      0
    )
    const sessionCost = sessionStats.totalCostUSD
    const otherCost = Math.max(
      0,
      sessionCost - orchestrationCost - ambientCost
    )

    return [
      {
        label: 'Orchestrations',
        amount: orchestrationCost,
        color: 'var(--accent-primary, #a855f7)',
      },
      {
        label: 'Agent runs',
        amount: otherCost,
        color: 'var(--color-info, #3b82f6)',
      },
      {
        label: 'Ambient analysis',
        amount: ambientCost,
        color: 'var(--color-success, #22c55e)',
      },
    ]
  }, [costHistory, sessionStats.totalCostUSD])

  const maxCategoryAmount = Math.max(
    ...costCategories.map((c) => c.amount),
    0.001
  )

  // Budget percentage
  const budgetPercentage =
    dailyBudgetLimit > 0
      ? Math.min(100, (dailyBudgetUsed / dailyBudgetLimit) * 100)
      : 0

  const budgetRemaining = Math.max(0, dailyBudgetLimit - dailyBudgetUsed)

  // Is budget warning?
  const isBudgetWarning = budgetPercentage > 80
  const isBudgetExceeded = budgetPercentage >= 100

  // Recent snapshots (last 20)
  const recentSnapshots = costHistory.slice(-20).reverse()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Cost Dashboard
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-100px)] mt-4">
          <div className="space-y-4 pr-2">
            {/* Session Total */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Session Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-2xl font-mono font-bold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    ${sessionStats.totalCostUSD.toFixed(4)}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {sessionStats.totalRequests} requests
                  </span>
                </div>
                <div
                  className="text-xs mt-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {(
                    sessionStats.totalInputTokens +
                    sessionStats.totalOutputTokens
                  ).toLocaleString()}{' '}
                  total tokens
                </div>
              </CardContent>
            </Card>

            {/* Cost by Category */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">By Category</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {costCategories.map((cat) => (
                  <CostBar
                    key={cat.label}
                    label={cat.label}
                    amount={cat.amount}
                    maxAmount={maxCategoryAmount}
                    color={cat.color}
                  />
                ))}
              </CardContent>
            </Card>

            {/* Budget Status */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  Budget Status
                  {isBudgetExceeded && (
                    <Badge
                      variant="destructive"
                      className="text-[9px] px-1 h-4"
                    >
                      <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                      Exceeded
                    </Badge>
                  )}
                  {isBudgetWarning && !isBudgetExceeded && (
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1 h-4"
                      style={{ color: 'var(--color-warning, #f59e0b)' }}
                    >
                      Warning
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span style={{ color: 'var(--text-muted)' }}>
                    Daily limit:
                  </span>
                  <span
                    className="font-mono"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    ${dailyBudgetLimit.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: 'var(--text-muted)' }}>
                    Used today:
                  </span>
                  <span
                    className="font-mono"
                    style={{
                      color: isBudgetExceeded
                        ? 'var(--color-error, #dc2626)'
                        : isBudgetWarning
                          ? 'var(--color-warning, #f59e0b)'
                          : 'var(--text-primary)',
                    }}
                  >
                    ${dailyBudgetUsed.toFixed(4)}
                  </span>
                </div>
                <Progress
                  value={budgetPercentage}
                  className="h-2"
                />
                <div className="flex justify-between text-xs">
                  <span style={{ color: 'var(--text-muted)' }}>
                    Remaining:
                  </span>
                  <span
                    className="font-mono"
                    style={{ color: 'var(--color-success, #22c55e)' }}
                  >
                    ${budgetRemaining.toFixed(4)}
                  </span>
                </div>
                <span
                  className="text-[10px] block"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {Math.round(budgetPercentage)}% of daily budget used
                </span>
              </CardContent>
            </Card>

            {/* Model Breakdown */}
            {Object.keys(sessionStats.byModel).length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    By Model
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {Object.entries(sessionStats.byModel).map(
                    ([key, stats]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between text-xs"
                      >
                        <span style={{ color: 'var(--text-muted)' }}>
                          {stats.model}
                        </span>
                        <span
                          className="font-mono"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          ${stats.costUSD.toFixed(4)} ({stats.requestCount}x)
                        </span>
                      </div>
                    )
                  )}
                </CardContent>
              </Card>
            )}

            {/* Recent Costs */}
            {recentSnapshots.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Recent Costs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-0">
                    {recentSnapshots.map((snapshot, i) => (
                      <div key={`${snapshot.timestamp}-${i}`}>
                        {i > 0 && <Separator className="my-0.5" />}
                        <RecentCostEntry snapshot={snapshot} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

export const CostDashboard = memo(CostDashboardComponent)
