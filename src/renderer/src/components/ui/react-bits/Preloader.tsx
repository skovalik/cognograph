// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital
// Adapted from ReactBits Pro (reactbits.dev) — circle variant preloader

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import './Preloader.css'

export interface PreloaderProps {
  /** Whether the preloader is active */
  loading: boolean
  /** Visual variant of the preloader */
  variant?: 'stairs' | 'percentage' | 'circle' | 'slide' | 'curtain'
  /** Position type of the preloader container */
  position?: 'fixed' | 'absolute'
  /** Duration of the loading animation in milliseconds */
  duration?: number
  /** Loading text to display */
  loadingText?: string
  /** Callback when loading completes */
  onComplete?: () => void
  /** Callback when loading starts */
  onLoadingStart?: () => void
  /** Callback when exit animation completes */
  onLoadingComplete?: () => void
  /** Additional CSS classes */
  className?: string
  /** Z-index for the preloader */
  zIndex?: number
  /** Background color (overrides default) */
  bgColor?: string
  /** CSS classes for the loading text */
  textClassName?: string
  /** Content to show after loading */
  children?: React.ReactNode
  /** Respect prefers-reduced-motion setting */
  respectReducedMotion?: boolean
  /** Fallback behavior when reduced motion is preferred */
  reducedMotionFallback?: 'fade' | 'none'
  /** ARIA label for screen readers */
  ariaLabel?: string
  /** ARIA live region politeness */
  ariaLive?: 'polite' | 'assertive' | 'off'
  /** Progress threshold (0-100) when text starts fading */
  textFadeThreshold?: number
}

const Preloader: React.FC<PreloaderProps> = ({
  loading,
  variant = 'circle',
  position = 'fixed',
  duration = 2500,
  loadingText = 'Loading workspace',
  onComplete,
  onLoadingStart,
  onLoadingComplete,
  className = '',
  zIndex = 9999,
  bgColor,
  textClassName = '',
  children,
  respectReducedMotion = true,
  reducedMotionFallback = 'fade',
  ariaLabel = 'Loading workspace',
  ariaLive = 'polite',
  textFadeThreshold = 99,
}) => {
  const [progress, setProgress] = useState(loading ? 0 : 100)
  const [showPreloader, setShowPreloader] = useState(loading)
  const [hideText, setHideText] = useState(!loading)
  const rafRef = useRef<number | null>(null)
  const textHiddenRef = useRef(!loading)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const hasStartedRef = useRef(false)
  const prevLoadingRef = useRef(loading)

  useEffect(() => {
    const prevLoading = prevLoadingRef.current
    prevLoadingRef.current = loading
    if (loading && !prevLoading) {
      textHiddenRef.current = false
      flushSync(() => {
        setShowPreloader(true)
        setHideText(false)
        setProgress(0)
      })
    }
  }, [loading])

  useEffect(() => {
    if (!respectReducedMotion) return
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setPrefersReducedMotion(e.matches)
    }
    handleChange(mediaQuery)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [respectReducedMotion])

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>
    let completeTimeoutId: ReturnType<typeof setTimeout>

    if (loading) {
      const startTime = Date.now()
      let isActive = true

      if (!hasStartedRef.current) {
        hasStartedRef.current = true
        onLoadingStart?.()
      }

      const updateProgress = () => {
        if (!isActive) return
        const elapsed = Date.now() - startTime
        let newProgress = (elapsed / duration) * 100
        if (newProgress > 90) {
          const excess = newProgress - 90
          newProgress = 90 + excess * 0.1
        }
        newProgress = Math.min(newProgress, 99)
        setProgress(newProgress)
        if (newProgress >= textFadeThreshold && !textHiddenRef.current) {
          textHiddenRef.current = true
          setHideText(true)
        }
        rafRef.current = requestAnimationFrame(updateProgress)
      }

      updateProgress()

      return () => {
        isActive = false
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current)
          rafRef.current = null
        }
      }
    } else if (showPreloader) {
      hasStartedRef.current = false
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }

      const immediateTimeoutId = setTimeout(() => {
        setProgress(100)
        if (!textHiddenRef.current) {
          textHiddenRef.current = true
          setHideText(true)
        }
      }, 0)

      const textFadeDelay = 300

      timeoutId = setTimeout(() => {
        setShowPreloader(false)
        completeTimeoutId = setTimeout(() => {
          onComplete?.()
        }, 800)
      }, textFadeDelay)

      return () => {
        clearTimeout(immediateTimeoutId)
        clearTimeout(timeoutId)
        clearTimeout(completeTimeoutId)
      }
    }
  }, [loading, duration, onComplete, onLoadingStart, textFadeThreshold, showPreloader])

  const renderLoadingText = () => {
    const words = loadingText.split(' ')
    return (
      <div className="preloader-loading-text" style={{ zIndex: zIndex + 1 }}>
        <div className="preloader-loading-text-wrapper">
          {words.map((word, index) => (
            <motion.span
              key={index}
              initial={{ opacity: 0, filter: 'blur(10px)' }}
              animate={
                hideText
                  ? { opacity: 0, filter: 'blur(10px)' }
                  : { opacity: 1, filter: 'blur(0px)' }
              }
              transition={{
                duration: hideText ? 0.3 : 0.6,
                delay: hideText ? 0 : index * 0.1,
                ease: [0.65, 0, 0.35, 1],
              }}
              className={`preloader-loading-text-word ${textClassName}`}
            >
              {word}
            </motion.span>
          ))}
        </div>
      </div>
    )
  }

  const renderCircleVariant = () => {
    const shouldAnimate = !prefersReducedMotion || reducedMotionFallback !== 'none'
    const isReducedFade = prefersReducedMotion && reducedMotionFallback === 'fade'

    return (
      <div
        className={`preloader-circle preloader-${position}`}
        style={{ zIndex }}
        role="status"
        aria-label={ariaLabel}
        aria-live={ariaLive}
      >
        <motion.div
          initial={{ scale: 1, opacity: 1 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={isReducedFade ? { opacity: 0 } : shouldAnimate ? { scale: 0 } : { opacity: 0 }}
          transition={{
            duration: isReducedFade ? 0.3 : shouldAnimate ? 0.7 : 0.3,
            ease: [0.65, 0, 0.35, 1],
          }}
          className={`preloader-circle-shape ${bgColor ? '' : 'preloader-circle-colored'}`}
          style={{
            width: '300vmax',
            height: '300vmax',
            aspectRatio: '1',
            backgroundColor: bgColor,
          }}
        />
        {renderLoadingText()}
      </div>
    )
  }

  return (
    <div className={`preloader-wrapper ${className}`}>
      <AnimatePresence onExitComplete={onLoadingComplete}>
        {showPreloader && (
          <div key="preloader">{variant === 'circle' && renderCircleVariant()}</div>
        )}
      </AnimatePresence>
      <div className={`preloader-content ${showPreloader ? 'preloader-content-hidden' : ''}`}>
        {children}
      </div>
    </div>
  )
}

Preloader.displayName = 'Preloader'

export default Preloader
