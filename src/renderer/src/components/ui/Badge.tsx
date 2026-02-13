import type { ReactNode } from 'react'

interface BadgeProps {
  variant?: 'default' | 'accent'
  className?: string
  children: ReactNode
}

export function Badge({ variant = 'default', className = '', children }: BadgeProps) {
  return (
    <span className={`gui-badge gui-badge-${variant} ${className}`}>
      {children}
    </span>
  )
}
