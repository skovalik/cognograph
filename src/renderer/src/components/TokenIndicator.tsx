import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { useAIEditorStore } from '../stores/aiEditorStore'
import { useIsExtracting } from '../stores'

export const TokenIndicator = memo(function TokenIndicator() {
  const isGenerating = useAIEditorStore((s) => s.isGeneratingPlan)
  const isExecuting = useAIEditorStore((s) => s.isExecutingPlan)
  const isExtracting = useIsExtracting()

  const isActive = isGenerating || isExecuting || !!isExtracting

  let label = ''
  if (isGenerating) label = 'Generating plan...'
  else if (isExecuting) label = 'Executing...'
  else if (isExtracting) label = 'Extracting...'

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(139, 92, 246, 0.3)'
          }}
        >
          <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
          <span className="text-xs text-purple-300 font-mono">{label}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
