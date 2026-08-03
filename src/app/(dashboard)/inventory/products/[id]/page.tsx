import type { Metadata } from 'next'
import { ProductDetailClient } from '@/components/inventory/ProductDetailClient'

export const metadata: Metadata = { title: 'Product Detail' }

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ProductDetailClient productId={id} />
}
