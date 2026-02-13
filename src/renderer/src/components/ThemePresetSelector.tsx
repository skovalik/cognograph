import { memo } from 'react'
import { Check, Palette } from 'lucide-react'
import { THEME_PRESETS } from '../constants/themePresets'
import type { ThemeMode } from '@shared/types'

interface ThemePresetSelectorProps {
  onSelect: (presetId: string) => void
  currentPresetId: string | null
  mode: ThemeMode
}

function ThemePresetSelectorComponent({
  onSelect,
  currentPresetId,
  mode
}: ThemePresetSelectorProps): JSX.Element {
  return (
    <div className="space-y-2">
      {/* Preset grid - 4 columns */}
      <div className="grid grid-cols-4 gap-1.5">
        {THEME_PRESETS.map((preset) => {
          const modeColors = mode === 'dark' ? preset.dark : preset.light
          const isActive = currentPresetId === preset.id
          const isGradient = modeColors.canvasBackground.startsWith('linear-gradient')

          return (
            <button
              key={preset.id}
              onClick={() => onSelect(preset.id)}
              className={`
                relative p-1 rounded-lg border-2 transition-all
                ${
                  isActive
                    ? 'gui-ring-active'
                    : 'border-[var(--border-subtle)] hover:border-[var(--text-muted)]'
                }
              `}
              title={preset.description || preset.name}
            >
              {/* Mini canvas preview */}
              <div
                className="w-full h-7 rounded-md mb-1 relative overflow-hidden"
                style={{
                  background: modeColors.canvasBackground
                }}
              >
                {/* Grid dots preview */}
                {!isGradient && (
                  <div
                    className="absolute inset-0 opacity-60"
                    style={{
                      backgroundImage: `radial-gradient(${modeColors.canvasGridColor} 1px, transparent 1px)`,
                      backgroundSize: '4px 4px'
                    }}
                  />
                )}
                {isGradient && (
                  <div
                    className="absolute inset-0 opacity-40"
                    style={{
                      backgroundImage: `radial-gradient(${modeColors.canvasGridColor} 1px, transparent 1px)`,
                      backgroundSize: '4px 4px'
                    }}
                  />
                )}
              </div>

              {/* Node color swatches */}
              <div className="flex gap-0.5 justify-center">
                {Object.values(modeColors.nodeColors).map((color, i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>

              {/* Theme name */}
              <div
                className="text-[8px] mt-0.5 text-center truncate text-[var(--text-secondary)]"
              >
                {preset.name}
              </div>

              {/* Active checkmark */}
              {isActive && (
                <div
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--gui-accent-primary)' }}
                >
                  <Check className="w-2 h-2 text-white" strokeWidth={3} />
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Custom indicator when no preset is active */}
      {currentPresetId === null && (
        <div
          className="flex items-center justify-center gap-1.5 py-1 rounded text-[10px] bg-[var(--surface-panel)] text-[var(--text-secondary)]"
        >
          <Palette className="w-3 h-3" />
          <span>Custom theme active</span>
        </div>
      )}
    </div>
  )
}

export const ThemePresetSelector = memo(ThemePresetSelectorComponent)
