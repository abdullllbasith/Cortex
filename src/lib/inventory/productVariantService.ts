import { Prisma } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/db/prisma'
import { generateUniqueEAN13 } from './barcodeService'

function toDecimal(value: number): Decimal {
  return new Decimal(value)
}

export interface VariantAttribute {
  name: string
  values: string[]
}

export interface VariantMatrixInput {
  attributes: VariantAttribute[]
  baseSku?: string
  defaultCostPrice?: number
  defaultSellingPrice?: number
}

export interface VariantUpsertInput {
  id?: string
  name: string
  sku?: string
  barcode?: string | null
  attributes?: Record<string, string>
  costPrice?: number | null
  sellingPrice?: number | null
  imageUrl?: string | null
  isActive?: boolean
}

function cartesianProduct(attributes: VariantAttribute[]): Array<Record<string, string>> {
  if (!attributes.length) return []
  return attributes.reduce<Array<Record<string, string>>>(
    (acc, attr) => {
      if (!acc.length) return attr.values.map((v) => ({ [attr.name]: v }))
      const next: Array<Record<string, string>> = []
      for (const combo of acc) {
        for (const value of attr.values) {
          next.push({ ...combo, [attr.name]: value })
        }
      }
      return next
    },
    [],
  )
}

function slugPart(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 12)
}

export function buildVariantMatrix(
  productSku: string,
  input: VariantMatrixInput,
): Array<Omit<VariantUpsertInput, 'id'>> {
  const combos = cartesianProduct(input.attributes.filter((a) => a.name && a.values.length))
  return combos.map((attrs) => {
    const name = Object.values(attrs).join(' / ')
    const skuSuffix = Object.values(attrs).map(slugPart).join('-')
    return {
      name,
      sku: input.baseSku ? `${input.baseSku}-${skuSuffix}` : `${productSku}-${skuSuffix}`,
      attributes: attrs,
      costPrice: input.defaultCostPrice ?? null,
      sellingPrice: input.defaultSellingPrice ?? null,
      isActive: true,
    }
  })
}

export async function listProductVariants(tenantId: string, productId: string) {
  return prisma.productVariant.findMany({
    where: { tenantId, productId },
    orderBy: { name: 'asc' },
    include: {
      stockBalances: {
        include: { warehouse: { select: { id: true, name: true, code: true } } },
      },
    },
  })
}

export async function syncProductVariants(
  tenantId: string,
  productId: string,
  variants: VariantUpsertInput[],
) {
  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId },
    select: { id: true, sku: true },
  })
  if (!product) throw new Error('Product not found')

  const existing = await prisma.productVariant.findMany({
    where: { tenantId, productId },
    select: { id: true },
  })
  const keepIds = new Set(variants.filter((v) => v.id).map((v) => v.id!))

  const toDelete = existing.filter((e) => !keepIds.has(e.id)).map((e) => e.id)
  if (toDelete.length) {
    await prisma.productVariant.deleteMany({ where: { id: { in: toDelete }, tenantId, productId } })
  }

  const results = []
  for (const v of variants) {
    const sku = v.sku?.trim() || `${product.sku}-${Date.now().toString(36)}`
    const data = {
      name: v.name,
      sku,
      barcode: v.barcode ?? null,
      attributes: (v.attributes ?? {}) as Prisma.InputJsonValue,
      costPrice: v.costPrice != null ? toDecimal(v.costPrice) : null,
      sellingPrice: v.sellingPrice != null ? toDecimal(v.sellingPrice) : null,
      imageUrl: v.imageUrl ?? null,
      isActive: v.isActive !== false,
    }

    if (v.id) {
      results.push(
        await prisma.productVariant.update({
          where: { id: v.id },
          data,
        }),
      )
    } else {
      results.push(
        await prisma.productVariant.create({
          data: { ...data, tenantId, productId },
        }),
      )
    }
  }
  return results
}

export async function generateVariantBarcode(tenantId: string, variantId: string) {
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, tenantId },
  })
  if (!variant) throw new Error('Variant not found')
  const barcode = await generateUniqueEAN13(tenantId)
  return prisma.productVariant.update({
    where: { id: variantId },
    data: { barcode },
  })
}

export async function generateMatrixAndSync(
  tenantId: string,
  productId: string,
  input: VariantMatrixInput,
) {
  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId },
    select: { sku: true, costPrice: true, sellingPrice: true },
  })
  if (!product) throw new Error('Product not found')

  const matrix = buildVariantMatrix(product.sku, {
    ...input,
    baseSku: input.baseSku ?? product.sku,
    defaultCostPrice: input.defaultCostPrice ?? product.costPrice.toNumber(),
    defaultSellingPrice: input.defaultSellingPrice ?? product.sellingPrice.toNumber(),
  })

  const existing = await prisma.productVariant.findMany({
    where: { tenantId, productId },
  })
  const byName = new Map(existing.map((e) => [e.name, e]))

  const merged = matrix.map((m) => {
    const match = byName.get(m.name)
    return match
      ? {
          id: match.id,
          name: m.name,
          sku: match.sku,
          barcode: match.barcode,
          attributes: m.attributes,
          costPrice: match.costPrice?.toNumber() ?? m.costPrice,
          sellingPrice: match.sellingPrice?.toNumber() ?? m.sellingPrice,
          imageUrl: match.imageUrl,
          isActive: match.isActive,
        }
      : m
  })

  return syncProductVariants(tenantId, productId, merged)
}
