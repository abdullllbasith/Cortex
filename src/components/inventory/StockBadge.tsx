import { Badge } from '@/components/ui'
import type { BadgeVariant } from '@/components/ui'

export type StockHealth = 'in_stock' | 'low_stock' | 'out_of_stock'

const LABELS: Record<StockHealth, string> = {
  in_stock: 'In Stock',
  low_stock: 'Low Stock',
  out_of_stock: 'Out of Stock',
}

const VARIANTS: Record<StockHealth, BadgeVariant> = {
  in_stock: 'success',
  low_stock: 'warning',
  out_of_stock: 'danger',
}

export function StockBadge({ health }: { health: StockHealth }) {
  return <Badge variant={VARIANTS[health]}>{LABELS[health]}</Badge>
}
