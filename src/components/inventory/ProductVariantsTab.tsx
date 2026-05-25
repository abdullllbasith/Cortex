'use client'

import { useCallback, useMemo, useState } from 'react'
import useSWR from 'swr'
import { Grid3X3, Plus, Save, Trash2, Wand2 } from 'lucide-react'
import { Button, Card, CardBody, Input, toast } from '@/components/ui'
import { BarcodeField } from '@/components/inventory/BarcodeField'
import { swrFetcher } from '@/lib/api/apiClient'

interface VariantRow {
  id?: string
  name: string
  sku: string
  barcode: string
  costPrice: number | null
  sellingPrice: number | null
  imageUrl: string
  isActive: boolean
  attributes: Record<string, string>
  stockByWarehouse: Array<{
    warehouseId: string
    warehouse: { name: string; code: string }
    quantityOnHand: number
  }>
}

interface AttributeDef {
  name: string
  values: string
}

export function ProductVariantsTab({ productId, productSku }: { productId: string; productSku: string }) {
  const { data: variants = [], mutate, isLoading } = useSWR<VariantRow[]>(
    `/inventory/products/${productId}/variants`,
    swrFetcher,
  )

  const [rows, setRows] = useState<VariantRow[] | null>(null)
  const [attributes, setAttributes] = useState<AttributeDef[]>([{ name: 'Color', values: 'Red, Blue' }])
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  const displayRows = rows ?? variants

  const warehouses = useMemo(() => {
    const map = new Map<string, { name: string; code: string }>()
    for (const v of displayRows) {
      for (const s of v.stockByWarehouse ?? []) {
        map.set(s.warehouseId, s.warehouse)
      }
    }
    return [...map.entries()]
  }, [displayRows])

  const updateRow = (index: number, patch: Partial<VariantRow>) => {
    setRows((prev) => {
      const base = prev ?? variants
      return base.map((r, i) => (i === index ? { ...r, ...patch } : r))
    })
  }

  const addManualRow = () => {
    setRows((prev) => [
      ...(prev ?? variants),
      {
        name: 'New variant',
        sku: `${productSku}-VAR`,
        barcode: '',
        costPrice: null,
        sellingPrice: null,
        imageUrl: '',
        isActive: true,
        attributes: {},
        stockByWarehouse: [],
      },
    ])
  }

  const generateMatrix = async () => {
    setGenerating(true)
    try {
      const parsed = attributes
        .filter((a) => a.name.trim() && a.values.trim())
        .map((a) => ({
          name: a.name.trim(),
          values: a.values.split(',').map((v) => v.trim()).filter(Boolean),
        }))
      if (!parsed.length) {
        toast.error('Define at least one attribute with values')
        return
      }
      const res = await fetch(`/api/inventory/products/${productId}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'generate_matrix', attributes: parsed }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Matrix generation failed')
      toast.success('Variant matrix generated')
      setRows(null)
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setGenerating(false)
    }
  }

  const saveVariants = async () => {
    setSaving(true)
    try {
      const payload = (rows ?? variants).map((v) => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        barcode: v.barcode || null,
        attributes: v.attributes,
        costPrice: v.costPrice,
        sellingPrice: v.sellingPrice,
        imageUrl: v.imageUrl || null,
        isActive: v.isActive,
      }))
      const res = await fetch(`/api/inventory/products/${productId}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'sync', variants: payload }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Save failed')
      toast.success('Variants saved')
      setRows(null)
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const generateVariantBarcode = useCallback(
    async (index: number, variantId?: string) => {
      if (!variantId) {
        toast.error('Save variant first before generating barcode')
        return
      }
      const res = await fetch(`/api/inventory/products/${productId}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'generate_barcode', variantId }),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error?.message ?? 'Failed')
        return
      }
      updateRow(index, { barcode: json.data.barcode ?? '' })
      mutate()
    },
    [productId, mutate],
  )

  if (isLoading) return <p className="text-slate-500">Loading variants…</p>

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Wand2 className="h-4 w-4" /> Attribute Matrix
            </h3>
            <Button variant="secondary" size="sm" onClick={() => void generateMatrix()} disabled={generating}>
              <Grid3X3 className="h-4 w-4 mr-1" />
              {generating ? 'Generating…' : 'Generate variants'}
            </Button>
          </div>
          {attributes.map((attr, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="Attribute"
                placeholder="Color"
                value={attr.name}
                onChange={(e) =>
                  setAttributes((prev) => prev.map((a, j) => (j === i ? { ...a, name: e.target.value } : a)))
                }
              />
              <Input
                label="Values (comma-separated)"
                placeholder="Red, Blue, Green"
                value={attr.values}
                onChange={(e) =>
                  setAttributes((prev) => prev.map((a, j) => (j === i ? { ...a, values: e.target.value } : a)))
                }
              />
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setAttributes((prev) => [...prev, { name: '', values: '' }])}>
            <Plus className="h-4 w-4 mr-1" /> Add attribute
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0 overflow-x-auto">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold">{displayRows.length} variant(s)</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={addManualRow}>
                <Plus className="h-4 w-4 mr-1" /> Add row
              </Button>
              <Button size="sm" onClick={() => void saveVariants()} disabled={saving}>
                <Save className="h-4 w-4 mr-1" /> {saving ? 'Saving…' : 'Save all'}
              </Button>
            </div>
          </div>
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-slate-50 dark:bg-slate-900/50">
              <tr>
                <th className="text-left p-3">Variant</th>
                <th className="text-left p-3">SKU</th>
                <th className="text-left p-3">Barcode</th>
                <th className="text-right p-3">Cost</th>
                <th className="text-right p-3">Price</th>
                {warehouses.map(([id, wh]) => (
                  <th key={id} className="text-right p-3">{wh.code}</th>
                ))}
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {displayRows.length === 0 && (
                <tr><td colSpan={7 + warehouses.length} className="p-8 text-center text-slate-500">No variants — define attributes and generate matrix</td></tr>
              )}
              {displayRows.map((v, index) => (
                <tr key={v.id ?? index} className="border-t align-top">
                  <td className="p-3">
                    <Input value={v.name} onChange={(e) => updateRow(index, { name: e.target.value })} className="min-w-[140px]" />
                  </td>
                  <td className="p-3">
                    <Input value={v.sku} onChange={(e) => updateRow(index, { sku: e.target.value })} className="font-mono min-w-[120px]" />
                  </td>
                  <td className="p-3 min-w-[180px]">
                    <BarcodeField
                      value={v.barcode}
                      onChange={(barcode) => updateRow(index, { barcode })}
                      label=""
                    />
                  </td>
                  <td className="p-3">
                    <Input
                      type="number"
                      value={v.costPrice ?? ''}
                      onChange={(e) => updateRow(index, { costPrice: e.target.value ? Number(e.target.value) : null })}
                      className="w-24 text-right"
                    />
                  </td>
                  <td className="p-3">
                    <Input
                      type="number"
                      value={v.sellingPrice ?? ''}
                      onChange={(e) => updateRow(index, { sellingPrice: e.target.value ? Number(e.target.value) : null })}
                      className="w-24 text-right"
                    />
                  </td>
                  {warehouses.map(([whId]) => {
                    const stock = v.stockByWarehouse?.find((s) => s.warehouseId === whId)
                    return (
                      <td key={whId} className="p-3 text-right tabular-nums text-slate-600">
                        {stock?.quantityOnHand ?? 0}
                      </td>
                    )
                  })}
                  <td className="p-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setRows((prev) => (prev ?? variants).filter((_, j) => j !== index))
                      }
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  )
}
