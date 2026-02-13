import { useEffect, useRef } from 'react'
import type { ActionEvent, ScheduleTrigger, ActionNodeData } from '@shared/actionTypes'
import { useActionStore } from '../stores/actionStore'

/**
 * Parses simple cron expressions into millisecond intervals.
 *
 * Supported patterns:
 *   - `* /N * * * *`  → every N minutes (e.g., `* /5 * * * *`)
 *   - `0 * /N * * *`  → every N hours   (e.g., `0 * /2 * * *`)
 *   - `M H * * *`     → daily at HH:MM  (returns ms until next occurrence, then 24h interval)
 *   - `* /N * * * *`  → every N seconds  (6-field cron with seconds)
 *
 * Returns null for unrecognized patterns.
 */
export function parseCronToMs(cron: string): number | null {
  const parts = cron.trim().split(/\s+/)

  // 5-field cron: min hour dom month dow
  if (parts.length === 5) {
    const [min, hour] = parts

    // */N * * * * → every N minutes
    if (min.startsWith('*/') && hour === '*') {
      const n = parseInt(min.slice(2), 10)
      if (n > 0 && n <= 1440) return n * 60 * 1000
    }

    // 0 */N * * * → every N hours
    if (min === '0' && hour.startsWith('*/')) {
      const n = parseInt(hour.slice(2), 10)
      if (n > 0 && n <= 24) return n * 60 * 60 * 1000
    }

    // M H * * * → daily at specific time (use 24h interval)
    const minNum = parseInt(min, 10)
    const hourNum = parseInt(hour, 10)
    if (
      !isNaN(minNum) && !isNaN(hourNum) &&
      minNum >= 0 && minNum <= 59 &&
      hourNum >= 0 && hourNum <= 23 &&
      parts[2] === '*' && parts[3] === '*' && parts[4] === '*'
    ) {
      return 24 * 60 * 60 * 1000 // 24 hours
    }

    return null
  }

  // 6-field cron with seconds: sec min hour dom month dow
  if (parts.length === 6) {
    const [sec, min] = parts

    // */N * * * * * → every N seconds
    if (sec.startsWith('*/') && min === '*') {
      const n = parseInt(sec.slice(2), 10)
      if (n > 0 && n <= 3600) return n * 1000
    }

    // 0 */N * * * * → every N minutes (6-field)
    if (sec === '0' && min.startsWith('*/')) {
      const n = parseInt(min.slice(2), 10)
      if (n > 0 && n <= 1440) return n * 60 * 1000
    }

    return null
  }

  return null
}

/**
 * For daily "M H * * *" schedules, compute the initial delay until the next occurrence.
 */
function computeInitialDelay(cron: string): number | null {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return null

  const [min, hour, dom, month, dow] = parts
  if (dom !== '*' || month !== '*' || dow !== '*') return null

  const minNum = parseInt(min, 10)
  const hourNum = parseInt(hour, 10)
  if (isNaN(minNum) || isNaN(hourNum)) return null

  const now = new Date()
  const target = new Date()
  target.setHours(hourNum, minNum, 0, 0)

  // If the target time has already passed today, schedule for tomorrow
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1)
  }

  return target.getTime() - now.getTime()
}

interface ScheduleEntry {
  actionNodeId: string
  intervalMs: number
  timerId: ReturnType<typeof setInterval> | ReturnType<typeof setTimeout>
  isDailyTimeout: boolean // true if using initial setTimeout before switching to setInterval
}

/**
 * Hook that manages schedule-based triggers for action nodes.
 * Scans active actions for schedule triggers, parses their cron expressions,
 * and emits `schedule-tick` events at the appropriate intervals.
 *
 * Should be called once in App.tsx alongside useActionSubscription().
 */
export function useScheduleService(): void {
  const schedulesRef = useRef<Map<string, ScheduleEntry>>(new Map())

  useEffect(() => {
    const schedules = schedulesRef.current

    function emitScheduleTick(actionNodeId: string): void {
      const event: ActionEvent = {
        type: 'schedule-tick',
        nodeId: actionNodeId,
        timestamp: Date.now()
      }
      useActionStore.getState().handleEvent(event)
    }

    function setupSchedule(actionNodeId: string, trigger: ScheduleTrigger): void {
      // Remove existing schedule for this action
      teardownSchedule(actionNodeId)

      const intervalMs = parseCronToMs(trigger.cron)
      if (!intervalMs) return // Unsupported cron pattern

      const initialDelay = computeInitialDelay(trigger.cron)
      const isDailySchedule = initialDelay !== null && initialDelay !== intervalMs

      if (isDailySchedule) {
        // For daily schedules, first set a timeout until the target time,
        // then switch to a 24h interval
        const timeoutId = setTimeout(() => {
          emitScheduleTick(actionNodeId)
          const intervalId = setInterval(() => emitScheduleTick(actionNodeId), intervalMs)
          schedules.set(actionNodeId, {
            actionNodeId,
            intervalMs,
            timerId: intervalId,
            isDailyTimeout: false
          })
        }, initialDelay!)

        schedules.set(actionNodeId, {
          actionNodeId,
          intervalMs,
          timerId: timeoutId,
          isDailyTimeout: true
        })
      } else {
        // For interval-based schedules, just use setInterval
        const intervalId = setInterval(() => emitScheduleTick(actionNodeId), intervalMs)
        schedules.set(actionNodeId, {
          actionNodeId,
          intervalMs,
          timerId: intervalId,
          isDailyTimeout: false
        })
      }
    }

    function teardownSchedule(actionNodeId: string): void {
      const existing = schedules.get(actionNodeId)
      if (existing) {
        if (existing.isDailyTimeout) {
          clearTimeout(existing.timerId)
        } else {
          clearInterval(existing.timerId)
        }
        schedules.delete(actionNodeId)
      }
    }

    function syncSchedules(): void {
      const activeActions = useActionStore.getState().activeActions
      const activeScheduleIds = new Set<string>()

      // Set up schedules for active actions with schedule triggers
      for (const [nodeId, actionData] of activeActions) {
        if (actionData.trigger.type === 'schedule') {
          activeScheduleIds.add(nodeId)
          const trigger = actionData.trigger as ScheduleTrigger
          const existing = schedules.get(nodeId)

          // Only recreate if the cron expression changed or doesn't exist
          if (!existing || parseCronToMs(trigger.cron) !== existing.intervalMs) {
            setupSchedule(nodeId, trigger)
          }
        }
      }

      // Tear down schedules for actions that are no longer active
      for (const [nodeId] of schedules) {
        if (!activeScheduleIds.has(nodeId)) {
          teardownSchedule(nodeId)
        }
      }
    }

    // Initial sync
    syncSchedules()

    // Subscribe to action store changes
    const unsub = useActionStore.subscribe(
      (state) => state.activeActions,
      () => syncSchedules(),
      { equalityFn: Object.is }
    )

    return () => {
      unsub()
      // Clear all schedules on unmount
      for (const [nodeId] of schedules) {
        teardownSchedule(nodeId)
      }
    }
  }, [])
}
