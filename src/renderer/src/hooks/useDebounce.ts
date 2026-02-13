/**
 * Debounce Hook
 *
 * Returns a debounced version of the provided value.
 * Useful for delaying expensive operations like search or API calls.
 */

import { useState, useEffect } from 'react'

/**
 * Debounces a value by the specified delay.
 * The returned value will only update after the delay has passed
 * without the input value changing.
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    // Set up a timer to update the debounced value after the delay
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    // Clean up the timer if value changes before delay completes
    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

export default useDebounce
