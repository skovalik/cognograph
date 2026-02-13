import { forwardRef } from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="gui-text-secondary text-xs font-medium">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`gui-input rounded px-2 py-1.5 text-sm ${error ? 'border-red-500' : ''} ${className}`}
          {...props}
        />
        {hint && !error && (
          <span className="gui-text-secondary text-xs">{hint}</span>
        )}
        {error && (
          <span className="text-red-400 text-xs">{error}</span>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
