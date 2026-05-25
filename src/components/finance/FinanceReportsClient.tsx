'use client'

import { useCallback, useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  BarChart3,
  Scale,
  ArrowLeftRight,
  FileText,
  Receipt,
  Download,
  Printer,
} from 'lucide-react'
import { PageHeader, Card, CardBody, Button, Input, Badge } from '@/components/ui'
import { swrFetcher } from '@/lib/api/apiClient'

type ReportKey = 'pl' | 'balance-sheet' | 'cash-flow' | 'ar-aging' | 'ap-aging'

const REPORTS: Array<{ key: ReportKey; title: string; description: string; icon: React.ElementType; endpoint: string }> = [
  { key: 'pl', title: 'Profit & Loss', description: 'Revenue, expenses, gross profit, and net income', icon: BarChart3, endpoint: '/finance/reports/pl' },
  { key: 'balance-sheet', title: 'Balance Sheet', description: 'Assets, liabilities, and equity as of a date', icon: Scale, endpoint: '/finance/reports/balance-sheet' },
  { key: 'cash-flow', title: 'Cash Flow', description: 'Operating, investing, and financing activities', icon: ArrowLeftRight, endpoint: '/finance/reports/cash-flow' },
  { key: 'ar-aging', title: 'AR Aging', description: 'Outstanding invoices by overdue bucket', icon: FileText, endpoint: '/finance/ar-aging' },
  { key: 'ap-aging', title: 'AP Aging', description: 'Outstanding bills by overdue bucket', icon: Receipt, endpoint: '/finance/reports/ap-aging' },
]

function formatMoney(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function ReportTable({ rows, columns }: { rows: Record<string, unknown>[]; columns: Array<{ key: string; label: string; format?: (v: unknown) => string }> }) {
  if (!rows.length) return <p className="text-sm text-slate-500">No data for selected period.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-slate-500">
            {columns.map((c) => (
              <th key={c.key} className="p-2 font-medium">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
              {columns.map((c) => (
                <td key={c.key} className="p-2 tabular-nums">
                  {c.format ? c.format(row[c.key]) : String(row[c.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function FinanceReportsClient() {
  const searchParams = useSearchParams()
  const initialReport = (searchParams.get('report') as ReportKey) || null

  const [activeReport, setActiveReport] = useState<ReportKey | null>(initialReport)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10))

  const reportMeta = REPORTS.find((r) => r.key === activeReport)
  const queryString = useMemo(() => {
    if (!activeReport) return null
    const p = new URLSearchParams()
    if (activeReport === 'balance-sheet') {
      p.set('asOfDate', asOfDate)
    } else if (activeReport !== 'ar-aging' && activeReport !== 'ap-aging') {
      p.set('startDate', startDate)
      p.set('endDate', endDate)
    }
    return `${reportMeta?.endpoint}?${p.toString()}`
  }, [activeReport, startDate, endDate, asOfDate, reportMeta?.endpoint])

  const { data: reportData, isLoading } = useSWR<Record<string, unknown>>(
    queryString,
    swrFetcher,
    { revalidateOnFocus: false },
  )

  const handleExport = useCallback(() => {
    if (!reportData || !activeReport) return
    let rows: Record<string, unknown>[] = []
    if (activeReport === 'pl') {
      rows = [
        ...(reportData.revenue as Array<Record<string, unknown>> ?? []).map((r) => ({ section: 'Revenue', ...r })),
        ...(reportData.expenses as Array<Record<string, unknown>> ?? []).map((r) => ({ section: 'Expense', ...r })),
        { section: 'Summary', name: 'Net Income', amount: reportData.netIncome },
      ]
    } else if (activeReport === 'balance-sheet') {
      rows = [
        ...(reportData.assets as Array<Record<string, unknown>> ?? []).map((r) => ({ section: 'Assets', ...r })),
        ...(reportData.liabilities as Array<Record<string, unknown>> ?? []).map((r) => ({ section: 'Liabilities', ...r })),
        ...(reportData.equity as Array<Record<string, unknown>> ?? []).map((r) => ({ section: 'Equity', ...r })),
      ]
    } else if (activeReport === 'cash-flow') {
      const op = reportData.operating as { rows?: Array<Record<string, unknown>> }
      const inv = reportData.investing as { rows?: Array<Record<string, unknown>> }
      const fin = reportData.financing as { rows?: Array<Record<string, unknown>> }
      rows = [
        ...(op?.rows ?? []).map((r) => ({ section: 'Operating', ...r })),
        ...(inv?.rows ?? []).map((r) => ({ section: 'Investing', ...r })),
        ...(fin?.rows ?? []).map((r) => ({ section: 'Financing', ...r })),
      ]
    } else if (activeReport === 'ar-aging' || activeReport === 'ap-aging') {
      rows = (reportData.buckets as Array<Record<string, unknown>>) ?? []
    }

    const headers = rows.length ? Object.keys(rows[0]) : ['message']
    const csv = [
      reportMeta?.title ?? 'Report',
      headers.join(','),
      ...rows.map((row) => headers.map((h) => String(row[h] ?? '')).join(',')),
    ].join('\n')
    downloadCsv(`${activeReport}-${new Date().toISOString().slice(0, 10)}.csv`, csv)
  }, [reportData, activeReport, reportMeta?.title])

  if (!activeReport) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader
          title="Financial Reports"
          subtitle="P&L, balance sheet, cash flow, and aging reports"
          breadcrumbs={[
            { label: 'Finance', href: '/finance' },
            { label: 'Reports' },
          ]}
        />
        <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
          {REPORTS.map((report) => {
            const Icon = report.icon
            return (
              <button
                key={report.key}
                type="button"
                onClick={() => setActiveReport(report.key)}
                className="text-left"
              >
                <Card className="h-full cursor-pointer transition-colors hover:border-indigo-300">
                  <CardBody className="p-5">
                    <Icon className="mb-3 h-8 w-8 text-indigo-600" />
                    <h3 className="font-semibold">{report.title}</h3>
                    <p className="mt-1 text-sm text-slate-500">{report.description}</p>
                  </CardBody>
                </Card>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full print:block">
      <PageHeader
        title={reportMeta?.title ?? 'Report'}
        subtitle={reportMeta?.description}
        breadcrumbs={[
          { label: 'Finance', href: '/finance' },
          { label: 'Reports', href: '/finance/reports' },
          { label: reportMeta?.title ?? 'Report' },
        ]}
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={() => setActiveReport(null)}>
              <ArrowLeftRight className="mr-1 h-4 w-4 rotate-90" /> Back
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={!reportData}>
              <Download className="mr-1 h-4 w-4" /> Export Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-1 h-4 w-4" /> Print / PDF
            </Button>
          </div>
        }
      />

      <div className="flex-1 space-y-4 overflow-y-auto p-6 print:p-0">
        <Card className="print:hidden">
          <CardBody className="flex flex-wrap items-end gap-4 p-4">
            {activeReport === 'balance-sheet' ? (
              <div>
                <label className="mb-1 block text-xs text-slate-500">As of date</label>
                <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
              </div>
            ) : activeReport !== 'ar-aging' && activeReport !== 'ap-aging' ? (
              <>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Start date</label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">End date</label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </>
            ) : null}
            <Link href="/finance">
              <Button variant="secondary" size="sm">Dashboard</Button>
            </Link>
          </CardBody>
        </Card>

        <Card id="report-content">
          <CardBody className="p-6">
            {isLoading && <p className="text-slate-500">Loading report…</p>}

            {!isLoading && activeReport === 'pl' && reportData && (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-4">
                  <div><p className="text-xs text-slate-500">Revenue</p><p className="text-xl font-semibold">{formatMoney(Number(reportData.revenueTotal))}</p></div>
                  <div><p className="text-xs text-slate-500">Expenses</p><p className="text-xl font-semibold">{formatMoney(Number(reportData.expenseTotal))}</p></div>
                  <div><p className="text-xs text-slate-500">Gross Profit</p><p className="text-xl font-semibold">{formatMoney(Number(reportData.grossProfit))}</p></div>
                  <div><p className="text-xs text-slate-500">Net Income</p><p className="text-xl font-semibold">{formatMoney(Number(reportData.netIncome))}</p></div>
                </div>
                <div>
                  <h4 className="mb-2 font-medium">Revenue accounts</h4>
                  <ReportTable
                    rows={(reportData.revenue as Array<Record<string, unknown>>) ?? []}
                    columns={[
                      { key: 'code', label: 'Code' },
                      { key: 'name', label: 'Account' },
                      { key: 'amount', label: 'Amount', format: (v) => formatMoney(Number(v)) },
                    ]}
                  />
                </div>
                <div>
                  <h4 className="mb-2 font-medium">Expense accounts</h4>
                  <ReportTable
                    rows={(reportData.expenses as Array<Record<string, unknown>>) ?? []}
                    columns={[
                      { key: 'code', label: 'Code' },
                      { key: 'name', label: 'Account' },
                      { key: 'amount', label: 'Amount', format: (v) => formatMoney(Number(v)) },
                    ]}
                  />
                </div>
                <p className="text-sm text-slate-500">
                  Prior period net income: {formatMoney(Number((reportData.previousPeriod as { netIncome?: number })?.netIncome ?? 0))}
                  {' · '}
                  Change: {Number(reportData.changePercent)}%
                </p>
              </div>
            )}

            {!isLoading && activeReport === 'balance-sheet' && reportData && (
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <Badge variant={reportData.isBalanced ? 'success' : 'danger'}>
                    {reportData.isBalanced ? 'Balanced' : 'Out of balance'}
                  </Badge>
                  <span className="text-sm text-slate-500">As of {new Date(String(reportData.asOf)).toLocaleDateString()}</span>
                </div>
                {(['assets', 'liabilities', 'equity'] as const).map((section) => (
                  <div key={section}>
                    <h4 className="mb-2 font-medium capitalize">{section}</h4>
                    <ReportTable
                      rows={(reportData[section] as Array<Record<string, unknown>>) ?? []}
                      columns={[
                        { key: 'code', label: 'Code' },
                        { key: 'name', label: 'Account' },
                        { key: 'balance', label: 'Balance', format: (v) => formatMoney(Number(v)) },
                      ]}
                    />
                    <p className="mt-2 text-right font-semibold">
                      Total: {formatMoney(Number(reportData[`${section}Total`]))}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && activeReport === 'cash-flow' && reportData && (
              <div className="space-y-6">
                {(['operating', 'investing', 'financing'] as const).map((section) => {
                  const block = reportData[section] as { rows?: Array<Record<string, unknown>>; total?: number }
                  return (
                    <div key={section}>
                      <h4 className="mb-2 font-medium capitalize">{section} activities</h4>
                      <ReportTable
                        rows={block?.rows ?? []}
                        columns={[
                          { key: 'code', label: 'Code' },
                          { key: 'name', label: 'Account' },
                          { key: 'amount', label: 'Net', format: (v) => formatMoney(Number(v)) },
                        ]}
                      />
                      <p className="mt-2 text-right font-semibold">Subtotal: {formatMoney(Number(block?.total ?? 0))}</p>
                    </div>
                  )
                })}
                <p className="text-right text-lg font-semibold">Net change: {formatMoney(Number(reportData.netChange))}</p>
              </div>
            )}

            {!isLoading && (activeReport === 'ar-aging' || activeReport === 'ap-aging') && reportData && (
              <div>
                <p className="mb-4 text-xl font-semibold">Total outstanding: {formatMoney(Number(reportData.totalOutstanding))}</p>
                <ReportTable
                  rows={(reportData.buckets as Array<Record<string, unknown>>) ?? []}
                  columns={[
                    { key: 'label', label: 'Bucket' },
                    { key: 'count', label: 'Count' },
                    { key: 'total', label: 'Amount', format: (v) => formatMoney(Number(v)) },
                  ]}
                />
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
