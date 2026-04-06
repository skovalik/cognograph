// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { memo } from 'react'

interface CreditExhaustedPromptProps {
  onSignUp: () => void
  onByok: () => void
}

export const CreditExhaustedPrompt = memo(function CreditExhaustedPrompt({
  onSignUp,
  onByok,
}: CreditExhaustedPromptProps) {
  return (
    <div
      style={{
        padding: '16px 20px',
        background: 'var(--bg-secondary, #1a1916)',
        border: '1px solid var(--gold-dim, rgba(200,150,62,0.2))',
        borderRadius: '8px',
        fontFamily: 'var(--font-body, system-ui)',
        fontSize: '14px',
      }}
    >
      <p style={{ color: 'var(--fg, #EDE8E0)', marginBottom: '12px', fontWeight: 500 }}>
        Your trial credits are used up.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          onClick={onSignUp}
          style={{
            padding: '10px 16px',
            background: 'var(--gold, #C8963E)',
            color: 'var(--bg, #0A0908)',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            fontFamily: 'inherit',
          }}
        >
          Sign up — get $1 in credits
        </button>
        <button
          onClick={onByok}
          style={{
            padding: '8px 16px',
            background: 'none',
            color: 'var(--fg-dim, #a09888)',
            border: '1px solid var(--gold-dim, rgba(200,150,62,0.2))',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontFamily: 'inherit',
          }}
        >
          Paste your own API key
        </button>
        <a
          href="https://github.com/skovalik/cognograph"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'var(--fg-faint, #6b6560)',
            fontSize: '12px',
            textAlign: 'center',
            textDecoration: 'none',
          }}
        >
          Self-host free (AGPL-3.0)
        </a>
      </div>
    </div>
  )
})
