interface ElementBadgeProps {
  name: string | null | undefined
  size: number
  avatarUrl?: string | null
  className?: string
}

export default function ElementBadge({ name, size, className }: ElementBadgeProps) {
  const initials = name
    ? name.includes('@') ? name[0].toUpperCase() : name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '??'

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.4,
        fontFamily: 'var(--font-mono, monospace)',
        color: 'var(--fg, #EDE8E0)',
        background: 'var(--bg, #0A0908)',
        border: '1px solid color-mix(in srgb, var(--gold, #C8963E) 40%, transparent)',
      }}
    >
      {size > 32 ? `[${initials}]` : initials}
    </div>
  )
}
