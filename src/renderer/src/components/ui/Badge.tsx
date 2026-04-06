// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import type { ReactNode } from 'react'

interface BadgeProps {
  variant?: 'default' | 'accent'
  className?: string
  children: ReactNode
}

export function Badge({ variant = 'default', className = '', children }: BadgeProps) {
  return <span className={`gui-badge gui-badge-${variant} ${className}`}>{children}</span>
}
