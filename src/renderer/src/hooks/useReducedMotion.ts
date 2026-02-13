/**
 * useReducedMotion Hook
 *
 * Detects user's reduced motion preference and updates reactively.
 * Use this to disable or simplify animations for accessibility.
 */

import { useState, useEffect } from 'react'

/**
 * Hook to detect user's reduced motion preference.
 *
 * Usage:
 * ```tsx
 * const prefersReducedMotion = useReducedMotion()
 *
 * return (
 *   <div className={prefersReducedMotion ? 'no-animation' : 'animated'}>
 *     ...
 *   </div>
 * )
 * ```
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

    const handleChange = (e: MediaQueryListEvent): void => {
      setPrefersReducedMotion(e.matches)
    }

    // Modern browsers use addEventListener
    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  return prefersReducedMotion
}

export default useReducedMotion
