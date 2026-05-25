'use client'

import { Button, Modal } from '@/components/ui'

export interface ImportPreviewRow {
  rowIndex: number
  data: Record<string, string>
  errors: string[]
  warnings: string[]
  duplicateSku?: string
}

interface ImportPreviewModalProps {
  open: boolean
  onClose: () => void
  preview: ImportPreviewRow[]
  totalRows: number
  validRows: number
  errorRows: number
  duplicateStrategy: 'skip' | 'overwrite' | 'create_new'
  onDuplicateStrategyChange: (v: 'skip' | 'overwrite' | 'create_new') => void
  onConfirm: () => void
  importing: boolean
}

export function ImportPreviewModal({
  open,
  onClose,
  preview,
  totalRows,
  validRows,
  errorRows,
  duplicateStrategy,
  onDuplicateStrategyChange,
  onConfirm,
  importing,
}: ImportPreviewModalProps) {
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title="Import Preview">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        <p className="text-sm text-slate-600">
          {totalRows} rows · {validRows} valid · {errorRows} with errors
        </p>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Duplicate SKU handling</label>
          <select
            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={duplicateStrategy}
            onChange={(e) => onDuplicateStrategyChange(e.target.value as typeof duplicateStrategy)}
          >
            <option value="skip">Skip duplicates</option>
            <option value="overwrite">Overwrite existing</option>
            <option value="create_new">Create new (auto SKU)</option>
          </select>
        </div>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-2 pr-2">#</th>
              <th className="py-2 pr-2">Name</th>
              <th className="py-2 pr-2">SKU</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {preview.slice(0, 5).map((row) => (
              <tr key={row.rowIndex} className="border-b border-slate-100 align-top">
                <td className="py-2 pr-2">{row.rowIndex}</td>
                <td className="py-2 pr-2">{row.data.name}</td>
                <td className="py-2 pr-2 font-mono">{row.data.sku}</td>
                <td className="py-2">
                  {row.errors.length > 0 && (
                    <span className="text-red-600">{row.errors.join('; ')}</span>
                  )}
                  {row.errors.length === 0 && row.warnings.length > 0 && (
                    <span className="text-amber-600">{row.warnings.join('; ')}</span>
                  )}
                  {row.errors.length === 0 && row.warnings.length === 0 && (
                    <span className="text-emerald-600">OK</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {preview.length > 5 && (
          <p className="text-xs text-slate-400">Showing first 5 rows of validation output</p>
        )}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onConfirm} disabled={importing || validRows === 0}>
            {importing ? 'Importing…' : `Import ${validRows} product(s)`}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
