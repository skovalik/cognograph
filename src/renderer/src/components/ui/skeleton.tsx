import { cn } from '@/lib/utils'

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-[var(--surface-panel-secondary)]',
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
