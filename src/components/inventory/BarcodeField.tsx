'use client'

import { useCallback, useState } from 'react'
import { Barcode, Loader2 } from 'lucide-react'
import { Button, Input, toast } from '@/components/ui'
import { authFetch } from '@/lib/api/apiClient'

interface BarcodeFieldProps {
  value: string
  onChange: (value: string) => void
  label?: string
  className?: string
}

export function BarcodeField({ value, onChange, label = 'Barcode', className }: BarcodeFieldProps) {
  const [generating, setGenerating] = useState(false)
  const [previewSvg, setPreviewSvg] = useState<string | null>(null)

  const generate = useCallback(async () => {
    setGenerating(true)
    try {
      const res = await authFetch('/api/inventory/products/barcode/generate', {
        method: 'POST',
        credentials: 'include',
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Generation failed')
      onChange(json.data.barcode)
      setPreviewSvg(json.data.svg ?? null)
      toast.success('EAN-13 barcode generated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate barcode')
    } finally {
      setGenerating(false)
    }
  }, [onChange])

  return (
    <div className={className}>
      <label className="text-xs text-slate-500 mb-1 block">{label}</label>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="EAN-13 or custom"
          className="flex-1 font-mono"
        />
        <Button type="button" variant="outline" size="sm" onClick={() => void generate()} disabled={generating}>
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Barcode className="h-4 w-4" />}
        </Button>
      </div>
      {previewSvg && (
        <div
          className="mt-2 p-2 bg-white rounded border inline-block max-w-full overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: previewSvg }}
        />
      )}
    </div>
  )
}
