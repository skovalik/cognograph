/**
 * DecryptedText — text reveal animation with matrix-style character scramble.
 *
 * Adapted from React Bits (reactbits.dev) for Cognograph.
 * Characters scramble through random glyphs before resolving to the target text.
 * Used for agent status messages, loading states, splash screen text.
 *
 * The original uses `motion/react`. This version uses `framer-motion`.
 * When reduced motion is preferred, the text appears immediately without scramble.
 */

import { useEffect, useState, useRef, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { useReducedMotion } from '../../../hooks/useReducedMotion'
import { cn } from '../../../lib/utils'

export type DecryptedTextAnimateOn = 'hover' | 'view' | 'both'
export type RevealDirection = 'start' | 'end' | 'center'

export interface DecryptedTextProps {
  /** The target text to reveal */
  text: string
  /** Milliseconds between scramble iterations */
  speed?: number
  /** Number of scramble iterations before revealing (non-sequential mode) */
  maxIterations?: number
  /** If true, reveals characters one-by-one in order */
  sequential?: boolean
  /** Direction of sequential reveal */
  revealDirection?: RevealDirection
  /** Restrict scramble chars to only those present in the original text */
  useOriginalCharsOnly?: boolean
  /** Character set to scramble with */
  characters?: string
  /** When to trigger the animation */
  animateOn?: DecryptedTextAnimateOn
  /** Class for revealed characters */
  className?: string
  /** Class for the outer container */
  parentClassName?: string
  /** Class for still-encrypted characters */
  encryptedClassName?: string
}

const srOnlyStyle: CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  border: '0',
}

const DEFAULT_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+'

function getNextRevealIndex(revealedSet: Set<number>, textLength: number, direction: RevealDirection): number {
  switch (direction) {
    case 'end':
      return textLength - 1 - revealedSet.size
    case 'center': {
      const middle = Math.floor(textLength / 2)
      const offset = Math.floor(revealedSet.size / 2)
      const candidate = revealedSet.size % 2 === 0
        ? middle + offset
        : middle - offset - 1
      if (candidate >= 0 && candidate < textLength && !revealedSet.has(candidate)) {
        return candidate
      }
      for (let i = 0; i < textLength; i++) {
        if (!revealedSet.has(i)) return i
      }
      return 0
    }
    default: // 'start'
      return revealedSet.size
  }
}

function shuffleText(
  originalText: string,
  currentRevealed: Set<number>,
  availableChars: string[],
): string {
  return originalText
    .split('')
    .map((char, i) => {
      if (char === ' ') return ' '
      if (currentRevealed.has(i)) return originalText[i]
      return availableChars[Math.floor(Math.random() * availableChars.length)] ?? char
    })
    .join('')
}

export function DecryptedText({
  text,
  speed = 50,
  maxIterations = 10,
  sequential = false,
  revealDirection = 'start',
  useOriginalCharsOnly = false,
  characters = DEFAULT_CHARS,
  animateOn = 'view',
  className,
  parentClassName,
  encryptedClassName,
}: DecryptedTextProps): JSX.Element {
  const prefersReducedMotion = useReducedMotion()
  const [displayText, setDisplayText] = useState(text)
  const [isHovering, setIsHovering] = useState(false)
  const [isScrambling, setIsScrambling] = useState(false)
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(new Set())
  const [hasAnimated, setHasAnimated] = useState(false)
  const containerRef = useRef<HTMLSpanElement>(null)

  // Scramble logic — only runs when not in reduced-motion mode
  useEffect(() => {
    if (prefersReducedMotion) return

    let interval: ReturnType<typeof setInterval> | null = null
    let currentIteration = 0

    const availableChars = useOriginalCharsOnly
      ? Array.from(new Set(text.split(''))).filter((char) => char !== ' ')
      : characters.split('')

    if (isHovering) {
      setIsScrambling(true)
      interval = setInterval(() => {
        setRevealedIndices((prevRevealed) => {
          if (sequential) {
            if (prevRevealed.size < text.length) {
              const nextIndex = getNextRevealIndex(prevRevealed, text.length, revealDirection)
              const newRevealed = new Set(prevRevealed)
              newRevealed.add(nextIndex)
              setDisplayText(shuffleText(text, newRevealed, availableChars))
              return newRevealed
            }
            if (interval) clearInterval(interval)
            setIsScrambling(false)
            return prevRevealed
          }

          setDisplayText(shuffleText(text, prevRevealed, availableChars))
          currentIteration++
          if (currentIteration >= maxIterations) {
            if (interval) clearInterval(interval)
            setIsScrambling(false)
            setDisplayText(text)
          }
          return prevRevealed
        })
      }, speed)
    } else {
      setDisplayText(text)
      setRevealedIndices(new Set())
      setIsScrambling(false)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [prefersReducedMotion, isHovering, text, speed, maxIterations, sequential, revealDirection, characters, useOriginalCharsOnly])

  // IntersectionObserver for 'view' / 'both' trigger
  useEffect(() => {
    if (prefersReducedMotion) return
    if (animateOn !== 'view' && animateOn !== 'both') return

    const currentRef = containerRef.current
    if (!currentRef) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !hasAnimated) {
            setIsHovering(true)
            setHasAnimated(true)
          }
        }
      },
      { threshold: 0.1 },
    )

    observer.observe(currentRef)

    return () => {
      observer.unobserve(currentRef)
    }
  }, [prefersReducedMotion, animateOn, hasAnimated])

  // Reduced motion: render plain text
  if (prefersReducedMotion) {
    return (
      <span className={cn(parentClassName)}>
        <span className={cn(className)}>{text}</span>
      </span>
    )
  }

  const hoverProps =
    animateOn === 'hover' || animateOn === 'both'
      ? {
          onMouseEnter: () => setIsHovering(true),
          onMouseLeave: () => setIsHovering(false),
        }
      : {}

  return (
    <motion.span
      className={cn(parentClassName)}
      ref={containerRef}
      style={{ display: 'inline-block', whiteSpace: 'pre-wrap' }}
      {...hoverProps}
    >
      {/* Screen-reader accessible text */}
      <span style={srOnlyStyle}>{displayText}</span>

      <span aria-hidden="true">
        {displayText.split('').map((char, index) => {
          const isRevealedOrDone = revealedIndices.has(index) || !isScrambling || !isHovering

          return (
            <span
              key={index}
              className={cn(isRevealedOrDone ? className : encryptedClassName)}
            >
              {char}
            </span>
          )
        })}
      </span>
    </motion.span>
  )
}
