// EdgeGrammarLegend — PFD Phase 3A: Connection Grammar Legend
// Togglable legend decoding edge colors/weights/patterns.
// Positioned in canvas corner. Triggered by toolbar button or shortcut.

import { memo, useCallback } from 'react'
import { X } from 'lucide-react'

interface EdgeGrammarLegendProps {
  onClose: () => void
}

// Edge grammar specification from PFD Implementation Plan
const EDGE_GRAMMAR = [
  {
    category: 'Strength',
    items: [
      { visual: 'thick', label: 'Strong', desc: 'Core dependency', strokeWidth: 4, dash: undefined, opacity: 1 },
      { visual: 'medium', label: 'Normal', desc: 'Standard connection', strokeWidth: 2.5, dash: undefined, opacity: 0.9 },
      { visual: 'thin', label: 'Light', desc: 'Weak/tentative link', strokeWidth: 1.5, dash: '6,4', opacity: 0.7 }
    ]
  },
  {
    category: 'Direction',
    items: [
      { visual: 'arrow', label: 'Directed', desc: 'Information flows one way', strokeWidth: 2.5, dash: undefined, opacity: 0.9, arrow: true },
      { visual: 'bidir', label: 'Bidirectional', desc: 'Two-way connection', strokeWidth: 2.5, dash: undefined, opacity: 0.9, bidir: true }
    ]
  },
  {
    category: 'Style',
    items: [
      { visual: 'solid', label: 'Solid', desc: 'Active connection', strokeWidth: 2.5, dash: undefined, opacity: 0.9 },
      { visual: 'dashed', label: 'Dashed', desc: 'Inactive / workspace link', strokeWidth: 2, dash: '8,4', opacity: 0.6 },
      { visual: 'dotted', label: 'Dotted', desc: 'Optional / tentative', strokeWidth: 2, dash: '2,4', opacity: 0.8 }
    ]
  }
]

function EdgeGrammarLegendComponent({ onClose }: EdgeGrammarLegendProps): JSX.Element {
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  return (
    <div className="edge-grammar-legend" onKeyDown={handleKeyDown} tabIndex={-1}>
      <div className="edge-grammar-legend__header">
        <span className="edge-grammar-legend__title">Connection Grammar</span>
        <button className="edge-grammar-legend__close" onClick={onClose} aria-label="Close">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="edge-grammar-legend__body">
        {EDGE_GRAMMAR.map(group => (
          <div key={group.category} className="edge-grammar-legend__group">
            <div className="edge-grammar-legend__group-title">{group.category}</div>
            {group.items.map(item => (
              <div key={item.label} className="edge-grammar-legend__item">
                <svg className="edge-grammar-legend__swatch" width="40" height="16" viewBox="0 0 40 16">
                  <line
                    x1="2" y1="8" x2={item.arrow || item.bidir ? 32 : 38} y2="8"
                    stroke="var(--gui-text-secondary)"
                    strokeWidth={item.strokeWidth}
                    strokeDasharray={item.dash}
                    opacity={item.opacity}
                    strokeLinecap="round"
                  />
                  {item.arrow && (
                    <polygon points="32,4 38,8 32,12" fill="var(--gui-text-secondary)" opacity={item.opacity} />
                  )}
                  {item.bidir && (
                    <>
                      <polygon points="32,4 38,8 32,12" fill="var(--gui-text-secondary)" opacity={item.opacity} />
                      <polygon points="8,4 2,8 8,12" fill="var(--gui-text-secondary)" opacity={item.opacity} />
                    </>
                  )}
                </svg>
                <span className="edge-grammar-legend__label">{item.label}</span>
                <span className="edge-grammar-legend__desc">{item.desc}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export const EdgeGrammarLegend = memo(EdgeGrammarLegendComponent)
