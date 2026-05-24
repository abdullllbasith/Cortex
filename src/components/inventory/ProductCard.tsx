'use client'

import Link from 'next/link'
import { Package } from 'lucide-react'
import { Card, CardBody } from '@/components/ui'
import { StockBadge, type StockHealth } from './StockBadge'

export interface ProductCardData {
  id: string
  name: string
  sku: string
  sellingPrice: number
  onHand: number
  stockHealth: StockHealth
  imageUrls?: string[]
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const image = product.imageUrls?.[0]

  return (
    <Link href={`/inventory/products/${product.id}`}>
      <Card className="h-full hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
        <CardBody className="p-4 space-y-3">
          <div className="aspect-square rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <Package className="h-10 w-10 text-slate-400" />
            )}
          </div>
          <div>
            <p className="font-medium text-sm line-clamp-2">{product.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">{product.sku}</p>
          </div>
          <div className="flex items-center justify-between">
            <StockBadge health={product.stockHealth} />
            <span className="text-sm font-semibold tabular-nums">{formatMoney(product.sellingPrice)}</span>
          </div>
          <p className="text-xs text-slate-500">{product.onHand} on hand</p>
        </CardBody>
      </Card>
    </Link>
  )
}
