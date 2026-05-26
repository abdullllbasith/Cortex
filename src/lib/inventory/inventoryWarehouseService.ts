import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import { calculateInventoryValue } from './valuationService'

function toNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0
  return typeof value === 'number' ? value : value.toNumber()
}

export async function listWarehousesWithStats(tenantId: string) {
  const warehouses = await prisma.warehouse.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    include: {
      manager: { select: { id: true, fullName: true } },
      stockBalances: {
        include: {
          product: { select: { id: true, costPrice: true } },
        },
      },
      _count: { select: { locations: true } },
    },
  })

  return warehouses.map((w) => {
    let totalSkus = 0
    let totalValue = 0
    for (const bal of w.stockBalances) {
      const qty = toNumber(bal.quantityOnHand)
      if (qty > 0) totalSkus++
      totalValue += qty * toNumber(bal.product.costPrice)
    }
    return {
      id: w.id,
      name: w.name,
      code: w.code,
      address: w.address,
      isDefault: w.isDefault,
      manager: w.manager,
      locationCount: w._count.locations,
      totalSkus,
      totalValue,
      activeStaff: w.manager ? 1 : 0,
    }
  })
}

export async function getWarehouseDetail(tenantId: string, warehouseId: string) {
  const warehouse = await prisma.warehouse.findFirst({
    where: { id: warehouseId, tenantId },
    include: {
      manager: { select: { id: true, fullName: true, email: true } },
      locations: true,
      stockBalances: {
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
              unit: true,
              costPrice: true,
              sellingPrice: true,
              imageUrls: true,
            },
          },
          variant: { select: { id: true, name: true, sku: true } },
        },
        orderBy: { product: { name: 'asc' } },
      },
    },
  })
  if (!warehouse) return null

  const valuation = await calculateInventoryValue(tenantId, warehouseId)

  return {
    id: warehouse.id,
    name: warehouse.name,
    code: warehouse.code,
    address: warehouse.address,
    isDefault: warehouse.isDefault,
    manager: warehouse.manager,
    locations: warehouse.locations,
    totalValue: valuation.totalValue,
    stock: warehouse.stockBalances.map((b) => ({
      productId: b.productId,
      variantId: b.variantId,
      product: b.product,
      variant: b.variant,
      quantityOnHand: toNumber(b.quantityOnHand),
      quantityReserved: toNumber(b.quantityReserved),
      quantityOnOrder: toNumber(b.quantityOnOrder),
      value: toNumber(b.quantityOnHand) * toNumber(b.product.costPrice),
    })),
  }
}

export async function createWarehouse(
  tenantId: string,
  data: {
    name: string
    code: string
    address?: Record<string, unknown>
    isDefault?: boolean
    managerId?: string
  },
) {
  if (data.isDefault) {
    await prisma.warehouse.updateMany({
      where: { tenantId, isDefault: true },
      data: { isDefault: false },
    })
  }
  return prisma.warehouse.create({
    data: {
      tenantId,
      name: data.name,
      code: data.code.toUpperCase(),
      address: (data.address ?? {}) as Prisma.InputJsonValue,
      isDefault: data.isDefault ?? false,
      managerId: data.managerId ?? null,
    },
  })
}

export async function createStockTransfer(
  tenantId: string,
  data: {
    fromWarehouseId: string
    toWarehouseId: string
    items: Array<{ productId: string; variantId?: string; quantity: number; unitCost?: number }>
    notes?: string
    scheduledDate?: string
    initiatedBy?: string
  },
) {
  const notes = [
    data.notes,
    data.scheduledDate ? `Scheduled: ${data.scheduledDate}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  return prisma.stockTransfer.create({
    data: {
      tenantId,
      fromWarehouseId: data.fromWarehouseId,
      toWarehouseId: data.toWarehouseId,
      status: 'DRAFT',
      items: data.items,
      notes: notes || null,
      initiatedBy: data.initiatedBy,
    },
  })
}

export async function listStockTransfers(
  tenantId: string,
  opts: { page?: number; limit?: number; status?: string } = {},
) {
  const page = opts.page ?? 1
  const limit = opts.limit ?? 20
  const where = {
    tenantId,
    ...(opts.status && { status: opts.status as 'DRAFT' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED' }),
  }

  const [transfers, total] = await Promise.all([
    prisma.stockTransfer.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        fromWarehouse: { select: { id: true, name: true, code: true } },
        toWarehouse: { select: { id: true, name: true, code: true } },
        initiator: { select: { fullName: true } },
      },
    }),
    prisma.stockTransfer.count({ where }),
  ])

  return { transfers, total, page, limit }
}
