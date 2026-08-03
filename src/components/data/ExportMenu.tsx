'use client'

import { useCallback } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Download, FileText, FileSpreadsheet, Printer, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ─────────────────────────────────────────────────────────────────────────────
   Types
   ───────────────────────────────────────────────────────────────────────────── */

export interface ExportMenuProps {
  data: unknown[]
  filename?: string
  className?: string
}

/* ─────────────────────────────────────────────────────────────────────────────
   Export helpers
   ───────────────────────────────────────────────────────────────────────────── */

function toCSV(data: unknown[]): string {
  if (!data.length) return ''
  const headers = Object.keys(data[0] as Record<string, unknown>)
  const rows    = data.map((row) =>
    headers.map((h) => {
      const v = (row as Record<string, unknown>)[h]
      const s = v == null ? '' : String(v)
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s
    }).join(','),
  )
  return [headers.join(','), ...rows].join('\n')
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}

async function exportExcel(data: unknown[], filename: string) {
  // Dynamic import so xlsx bundle is only loaded on demand
  const XLSX = await import('xlsx')
  const ws   = XLSX.utils.json_to_sheet(data)
  const wb   = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

/* ─────────────────────────────────────────────────────────────────────────────
   ExportMenu
   ───────────────────────────────────────────────────────────────────────────── */

const itemCls = cn(
  'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm outline-none',
  'text-slate-700 dark:text-slate-300',
  'data-[highlighted]:bg-slate-100 data-[highlighted]:text-slate-900',
  'dark:data-[highlighted]:bg-slate-800 dark:data-[highlighted]:text-slate-100',
  'transition-colors',
)

export function ExportMenu({ data, filename = 'export', className }: ExportMenuProps) {
  const handleCSV = useCallback(() => {
    downloadBlob(toCSV(data), `${filename}.csv`, 'text/csv;charset=utf-8;')
  }, [data, filename])

  const handleExcel = useCallback(() => {
    exportExcel(data, filename)
  }, [data, filename])

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Export data"
          className={cn(
            'flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium',
            'border-slate-200 bg-white text-slate-600',
            'hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900',
            'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400',
            'dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
            'transition-colors',
            className,
          )}
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Export
          <ChevronDown className="h-3 w-3 text-slate-400" aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className={cn(
            'z-50 min-w-[160px] rounded-xl border p-1.5 shadow-lg',
            'bg-white dark:bg-slate-900',
            'border-slate-100 dark:border-slate-800',
            'animate-scaleIn',
          )}
        >
          <DropdownMenu.Item className={itemCls} onSelect={handleCSV}>
            <FileText className="h-4 w-4 text-slate-400" aria-hidden="true" />
            Export CSV
          </DropdownMenu.Item>

          <DropdownMenu.Item className={itemCls} onSelect={handleExcel}>
            <FileSpreadsheet className="h-4 w-4 text-slate-400" aria-hidden="true" />
            Export Excel
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="my-1 h-px bg-slate-100 dark:bg-slate-800" />

          <DropdownMenu.Item className={itemCls} onSelect={handlePrint}>
            <Printer className="h-4 w-4 text-slate-400" aria-hidden="true" />
            Print view
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
