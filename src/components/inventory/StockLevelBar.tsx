import { cn } from '@/lib/utils'

export function StockLevelBar({
  onHand,
  reorderPoint,
  max,
  className,
}: {
  onHand: number
  reorderPoint: number
  max?: number
  className?: string
}) {
  const cap = max ?? Math.max(onHand, reorderPoint * 2, 1)
  const pct = Math.min(100, (onHand / cap) * 100)
  const color =
    onHand <= 0 ? 'bg-red-500' : reorderPoint > 0 && onHand <= reorderPoint ? 'bg-amber-500' : 'bg-emerald-500'

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-slate-500 w-10 text-right">{onHand}</span>
    </div>
  )
}
