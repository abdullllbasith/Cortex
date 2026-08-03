import { prisma } from '@/lib/db/prisma'
import { classifyStock } from './inventoryDashboardService'

function toNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0
  return typeof value === 'number' ? value : value.toNumber()
}

export async function exportStockReport(tenantId: string) {
  const products = await prisma.product.findMany({
    where: { tenantId, isActive: true },
    orderBy: { name: 'asc' },
    include: {
      category: { select: { name: true } },
      supplier: { select: { name: true } },
      stockBalances: {
        include: { warehouse: { select: { name: true, code: true } } },
      },
    },
  })

  const rows: Array<Record<string, string | number>> = []

  for (const product of products) {
    const reorderPoint = toNumber(product.reorderPoint)
    const totalOnHand = product.stockBalances.reduce(
      (s, b) => s + toNumber(b.quantityOnHand),
      0,
    )
    const totalReserved = product.stockBalances.reduce(
      (s, b) => s + toNumber(b.quantityReserved),
      0,
    )
    const totalOnOrder = product.stockBalances.reduce(
      (s, b) => s + toNumber(b.quantityOnOrder),
      0,
    )

    if (product.stockBalances.length === 0) {
      rows.push({
        SKU: product.sku,
        Product: product.name,
        Category: product.category?.name ?? '',
        Supplier: product.supplier?.name ?? '',
        Warehouse: '',
        'On Hand': 0,
        Reserved: 0,
        'On Order': 0,
        Available: 0,
        'Reorder Point': reorderPoint,
        'Cost Price': toNumber(product.costPrice),
        'Selling Price': toNumber(product.sellingPrice),
        Status: classifyStock(0, reorderPoint),
      })
      continue
    }

    for (const bal of product.stockBalances) {
      const onHand = toNumber(bal.quantityOnHand)
      const reserved = toNumber(bal.quantityReserved)
      rows.push({
        SKU: product.sku,
        Product: product.name,
        Category: product.category?.name ?? '',
        Supplier: product.supplier?.name ?? '',
        Warehouse: `${bal.warehouse.code} — ${bal.warehouse.name}`,
        'On Hand': onHand,
        Reserved: reserved,
        'On Order': toNumber(bal.quantityOnOrder),
        Available: onHand - reserved,
        'Reorder Point': reorderPoint,
        'Cost Price': toNumber(product.costPrice),
        'Selling Price': toNumber(product.sellingPrice),
        Status: classifyStock(totalOnHand, reorderPoint),
      })
    }
  }

  return rows
}

export async function buildStockReportWorkbook(tenantId: string): Promise<Buffer> {
  const XLSX = await import('xlsx')
  const rows = await exportStockReport(tenantId)
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Stock Report')
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}
