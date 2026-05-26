import bwipjs from 'bwip-js'
import { prisma } from '@/lib/db/prisma'

/** Compute EAN-13 check digit for first 12 digits */
function ean13CheckDigit(digits12: string): string {
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const n = Number(digits12[i])
    sum += i % 2 === 0 ? n : n * 3
  }
  return String((10 - (sum % 10)) % 10)
}

/** Generate a unique EAN-13 barcode (prefix 590 = Poland test range, commonly used for internal codes) */
export function generateEAN13Code(existingCheck?: (code: string) => Promise<boolean>): string {
  const prefix = '590'
  for (let attempt = 0; attempt < 100; attempt++) {
    const body = prefix + String(Math.floor(Math.random() * 1e9)).padStart(9, '0')
    const code = body + ean13CheckDigit(body)
    if (!existingCheck) return code
  }
  const body = prefix + Date.now().toString().slice(-9)
  return body.slice(0, 12) + ean13CheckDigit(body.slice(0, 12))
}

export async function generateUniqueEAN13(tenantId: string): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const prefix = '590'
    const body = prefix + String(Math.floor(Math.random() * 1e9)).padStart(9, '0')
    const code = body + ean13CheckDigit(body)
    const [productHit, variantHit] = await Promise.all([
      prisma.product.findFirst({ where: { tenantId, barcode: code }, select: { id: true } }),
      prisma.productVariant.findFirst({ where: { tenantId, barcode: code }, select: { id: true } }),
    ])
    if (!productHit && !variantHit) return code
  }
  throw new Error('Could not generate unique barcode')
}

export async function renderEAN13Svg(code: string): Promise<string> {
  const toSvg = (bwipjs as unknown as { toSVG: (opts: Record<string, unknown>) => string }).toSVG
  return toSvg({
    bcid: 'ean13',
    text: code,
    scale: 2,
    height: 12,
    includetext: true,
  })
}

export interface BarcodeLookupResult {
  type: 'product' | 'variant'
  productId: string
  variantId?: string
  sku: string
  name: string
  barcode: string
  costPrice: number
  sellingPrice: number
}

export async function lookupByBarcode(
  tenantId: string,
  code: string,
): Promise<BarcodeLookupResult | null> {
  const barcode = code.trim()
  if (!barcode) return null

  const variant = await prisma.productVariant.findFirst({
    where: { tenantId, barcode, isActive: true },
    include: { product: { select: { id: true, name: true, sku: true, costPrice: true, sellingPrice: true } } },
  })
  if (variant) {
    return {
      type: 'variant',
      productId: variant.productId,
      variantId: variant.id,
      sku: variant.sku,
      name: `${variant.product.name} — ${variant.name}`,
      barcode: variant.barcode!,
      costPrice: variant.costPrice?.toNumber() ?? variant.product.costPrice.toNumber(),
      sellingPrice: variant.sellingPrice?.toNumber() ?? variant.product.sellingPrice.toNumber(),
    }
  }

  const product = await prisma.product.findFirst({
    where: { tenantId, barcode, isActive: true },
    select: { id: true, sku: true, name: true, barcode: true, costPrice: true, sellingPrice: true },
  })
  if (product && product.barcode) {
    return {
      type: 'product',
      productId: product.id,
      sku: product.sku,
      name: product.name,
      barcode: product.barcode,
      costPrice: product.costPrice.toNumber(),
      sellingPrice: product.sellingPrice.toNumber(),
    }
  }

  return null
}
