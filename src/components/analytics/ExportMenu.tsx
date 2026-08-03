'use client'

import { useState } from 'react'
import { Download, FileText, Mail } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'

interface ExportMenuProps {
  filename?: string
  rows?: Record<string, unknown>[]
  title?: string
  className?: string
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(',')),
  ]
  return lines.join('\n')
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function generatePdf(title: string, rows: Record<string, unknown>[]) {
  const { Document, Page, Text, View, StyleSheet, pdf } = await import('@react-pdf/renderer')

  const styles = StyleSheet.create({
    page: { padding: 40, fontSize: 10 },
    title: { fontSize: 16, marginBottom: 16, fontWeight: 'bold' },
    row: { flexDirection: 'row', borderBottom: '1px solid #eee', paddingVertical: 4 },
    cell: { flex: 1 },
  })

  const headers = rows.length ? Object.keys(rows[0]) : []

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.row}>
          {headers.map((h) => <Text key={h} style={styles.cell}>{h}</Text>)}
        </View>
        {rows.slice(0, 50).map((row, i) => (
          <View key={i} style={styles.row}>
            {headers.map((h) => <Text key={h} style={styles.cell}>{String(row[h] ?? '')}</Text>)}
          </View>
        ))}
      </Page>
    </Document>
  )

  const blob = await pdf(doc).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.replace(/\s+/g, '-').toLowerCase()}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

export function ExportMenu({ filename = 'analytics-export', rows = [], title = 'Analytics Report', className }: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const exportCsv = () => {
    downloadBlob(toCsv(rows), `${filename}.csv`, 'text/csv')
    setOpen(false)
  }

  const exportPdf = async () => {
    setBusy(true)
    try {
      await generatePdf(title, rows)
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  const exportEmail = () => {
    const subject = encodeURIComponent(title)
    const body = encodeURIComponent(`Please find the attached analytics data.\n\n${toCsv(rows).slice(0, 2000)}`)
    window.location.href = `mailto:?subject=${subject}&body=${body}`
    setOpen(false)
  }

  return (
    <div className={cn('relative inline-block', className)}>
      <Button variant="secondary" size="sm" onClick={() => setOpen(!open)}>
        <Download className="w-4 h-4 mr-1.5" />
        Export
      </Button>
      {open && (
        <div className="absolute right-0 mt-1 z-20 w-44 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1">
          <button type="button" onClick={exportCsv} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
            <Download className="w-4 h-4" /> CSV
          </button>
          <button type="button" onClick={exportPdf} disabled={busy} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50">
            <FileText className="w-4 h-4" /> PDF Report
          </button>
          <button type="button" onClick={exportEmail} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
            <Mail className="w-4 h-4" /> Send via Email
          </button>
        </div>
      )}
    </div>
  )
}
