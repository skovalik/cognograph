import { memo, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { create } from 'zustand'
import { playSound, playSuccessSound, playErrorSound } from '../../services/audioService'

// -----------------------------------------------------------------------------
// Toast Store
// -----------------------------------------------------------------------------

interface ToastState {
  message: string
  visible: boolean
  type: 'success' | 'info' | 'warning'
  timeoutId: ReturnType<typeof setTimeout> | null
}

interface ToastStore extends ToastState {
  show: (message: string, type?: 'success' | 'info' | 'warning', duration?: number) => void
  hide: () => void
}

export const useToastStore = create<ToastStore>((set, get) => ({
  message: '',
  visible: false,
  type: 'info',
  timeoutId: null,

  show: (message, type = 'info', duration = 3000) => {
    const { timeoutId } = get()
    if (timeoutId) clearTimeout(timeoutId)

    const newTimeoutId = setTimeout(() => {
      set({ visible: false, timeoutId: null })
    }, duration)

    set({ message, visible: true, type, timeoutId: newTimeoutId })

    // Play audio feedback based on toast type
    // ND-friendly: Auditory confirmation without requiring visual attention
    // Note: 'info' type doesn't play sound - it's used for many informational messages
    // that have their own audio (like undo/redo) or shouldn't be audible
    if (type === 'success') {
      playSuccessSound()
    } else if (type === 'warning') {
      playErrorSound()
    }
    // 'info' type: no sound (caller can add specific sounds like undo/redo)
  },

  hide: () => {
    const { timeoutId } = get()
    if (timeoutId) clearTimeout(timeoutId)
    set({ visible: false, timeoutId: null })
  }
}))

// Convenience function for external use
export function sciFiToast(message: string, type?: 'success' | 'info' | 'warning', duration?: number): void {
  useToastStore.getState().show(message, type, duration)
}

// -----------------------------------------------------------------------------
// SciFiToast Component
// -----------------------------------------------------------------------------

export const SciFiToast = memo(function SciFiToast() {
  const { message, visible, type } = useToastStore()
  const hide = useToastStore((s) => s.hide)

  const handleClick = useCallback(() => {
    hide()
  }, [hide])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const { timeoutId } = useToastStore.getState()
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [])

  const typeIcon = type === 'success' ? '\u2713' : type === 'warning' ? '\u26a0' : '\u2022'

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          onClick={handleClick}
          className="gui-toast gui-z-toasts fixed bottom-6 left-1/2 -translate-x-1/2 cursor-pointer"
          style={{ animation: 'scifi-toast-glow 2s ease-in-out infinite' }}
        >
          <span className="font-mono text-sm tracking-wide" style={{ color: 'var(--gui-accent-primary)' }}>
            <span className="mr-2 opacity-80">{typeIcon}</span>
            {message}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
