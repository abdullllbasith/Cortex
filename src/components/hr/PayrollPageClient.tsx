'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { ArrowLeft, Check, DollarSign, FileText, Play, Send } from 'lucide-react'
import {
  PageHeader,
  Card,
  CardBody,
  Badge,
  Button,
  ModalRoot,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
  toast,
} from '@/components/ui'
import { swrFetcher, apiClient } from '@/lib/api/apiClient'
import { ResponsiveContainer } from '@/components/layout/ResponsiveContainer'
import { DataTable, type ColumnDef } from '@/components/data/DataTable'

interface PayrollRunItem extends Record<string, unknown> {
  id: string
  month: number
  year: number
  periodLabel: string
  status: string
  totalGross: number
  totalDeductions: number
  totalNet: number
  employeeCount: number
  createdAt: string
}

interface PayrollRunsResponse {
  items: PayrollRunItem[]
}

interface PayrollRunDetail extends PayrollRunItem {
  slips: Array<{
    id: string
    employeeId: string
    employeeName: string
    employeeNumber: string
    departmentName: string | null
    grossSalary: number
    totalDeductions: number
    netSalary: number
    status: string
  }>
}

interface EstimateResponse {
  month: number
  year: number
  employeeCount: number
  estimatedTotalNet: number
  warnings: string[]
}

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  DRAFT: 'default',
  PROCESSING: 'info',
  REVIEW: 'warning',
  APPROVED: 'success',
  PAID: 'success',
  CANCELLED: 'danger',
}

export function PayrollPageClient() {
  const now = new Date()
  const [runMonth, setRunMonth] = useState(now.getMonth() + 1)
  const [runYear, setRunYear] = useState(now.getFullYear())
  const [showRunModal, setShowRunModal] = useState(false)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [approving, setApproving] = useState(false)
  const [sending, setSending] = useState(false)

  const { data, isLoading, mutate } = useSWR<PayrollRunsResponse>('/hr/payroll', swrFetcher)
  const { data: estimate, mutate: mutateEstimate } = useSWR<EstimateResponse>(
    showRunModal ? `/hr/payroll?estimate=true&month=${runMonth}&year=${runYear}` : null,
    swrFetcher,
  )
  const { data: runDetail, mutate: mutateDetail } = useSWR<PayrollRunDetail>(
    selectedRunId ? `/hr/payroll/${selectedRunId}` : null,
    swrFetcher,
  )

  const runs = data?.items ?? []

  const historyColumns: ColumnDef<PayrollRunItem>[] = useMemo(
    () => [
      {
        id: 'period',
        header: 'Period',
        cell: ({ row }) => (
          <button type="button" className="font-medium text-indigo-600 hover:underline" onClick={() => setSelectedRunId(row.id)}>
            {row.periodLabel}
          </button>
        ),
      },
      { id: 'employees', header: 'Employees', cell: ({ row }) => row.employeeCount },
      {
        id: 'net',
        header: 'Total net',
        cell: ({ row }) => `$${row.totalNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.status] ?? 'default'} size="sm">{row.status}</Badge>,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Button variant="ghost" size="sm" onClick={() => setSelectedRunId(row.id)}>
            View
          </Button>
        ),
      },
    ],
    [],
  )

  const slipColumns: ColumnDef<PayrollRunDetail['slips'][0] & Record<string, unknown>>[] = useMemo(
    () => [
      {
        id: 'employee',
        header: 'Employee',
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.employeeName}</p>
            <p className="text-xs text-slate-500">{row.employeeNumber}</p>
          </div>
        ),
      },
      { id: 'dept', header: 'Department', cell: ({ row }) => row.departmentName ?? '—' },
      {
        id: 'gross',
        header: 'Gross',
        cell: ({ row }) => `$${row.grossSalary.toFixed(2)}`,
      },
      {
        id: 'deductions',
        header: 'Deductions',
        cell: ({ row }) => `$${row.totalDeductions.toFixed(2)}`,
      },
      {
        id: 'net',
        header: 'Net',
        cell: ({ row }) => <span className="font-semibold">${row.netSalary.toFixed(2)}</span>,
      },
      {
        id: 'pdf',
        header: '',
        cell: ({ row }) =>
          selectedRunId ? (
            <a
              href={`/api/hr/payroll/${selectedRunId}/slips/${row.employeeId}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-xs text-indigo-600 hover:underline"
            >
              <FileText className="mr-1 h-3 w-3" /> PDF
            </a>
          ) : null,
      },
    ],
    [selectedRunId],
  )

  async function handleRunPayroll() {
    setRunning(true)
    try {
      const result = await apiClient.post<PayrollRunDetail>('/hr/payroll', { month: runMonth, year: runYear })
      toast.success('Payroll run completed')
      setShowRunModal(false)
      setSelectedRunId(result.id)
      await mutate()
      await mutateDetail()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Payroll run failed')
    } finally {
      setRunning(false)
    }
  }

  async function handleApprove() {
    if (!selectedRunId) return
    setApproving(true)
    try {
      await apiClient.post(`/hr/payroll/${selectedRunId}/approve`)
      toast.success('Payroll approved and posted to accounting')
      await mutate()
      await mutateDetail()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Approval failed')
    } finally {
      setApproving(false)
    }
  }

  async function handleSendSlips() {
    if (!selectedRunId) return
    setSending(true)
    try {
      const result = await apiClient.post<{ sent: number; failed: number; errors: string[] }>(
        `/hr/payroll/${selectedRunId}/send`,
      )
      toast.success(`Sent ${result.sent} payslip(s)`)
      if (result.failed > 0) toast.error(`${result.failed} failed to send`)
      await mutate()
      await mutateDetail()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Payroll"
        subtitle="Process salaries, approve runs, and distribute payslips"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'HR', href: '/hr' },
          { label: 'Payroll' },
        ]}
        actions={
          <div className="flex gap-2">
            <Link href="/hr">
              <Button variant="secondary" size="sm">
                <ArrowLeft className="mr-1.5 h-4 w-4" /> HR home
              </Button>
            </Link>
            <Button size="sm" onClick={() => { setShowRunModal(true); mutateEstimate() }}>
              <Play className="mr-1.5 h-4 w-4" /> Run payroll
            </Button>
          </div>
        }
      />

      <ResponsiveContainer className="flex-1 space-y-6 py-6">
        {selectedRunId && runDetail ? (
          <Card>
            <CardBody className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <button type="button" className="text-sm text-slate-500 hover:text-indigo-600" onClick={() => setSelectedRunId(null)}>
                    ← Back to history
                  </button>
                  <h3 className="text-lg font-semibold">{runDetail.periodLabel}</h3>
                  <Badge variant={STATUS_VARIANT[runDetail.status] ?? 'default'} size="sm">{runDetail.status}</Badge>
                </div>
                <div className="flex gap-2">
                  {runDetail.status === 'REVIEW' && (
                    <Button size="sm" loading={approving} onClick={handleApprove}>
                      <Check className="mr-1.5 h-4 w-4" /> Approve & post
                    </Button>
                  )}
                  {(runDetail.status === 'APPROVED' || runDetail.status === 'PAID') && (
                    <Button size="sm" loading={sending} onClick={handleSendSlips}>
                      <Send className="mr-1.5 h-4 w-4" /> Send payslips
                    </Button>
                  )}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                  <p className="text-xs text-slate-500">Employees</p>
                  <p className="text-lg font-semibold">{runDetail.employeeCount}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                  <p className="text-xs text-slate-500">Total gross</p>
                  <p className="text-lg font-semibold tabular-nums">${runDetail.totalGross.toLocaleString()}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                  <p className="text-xs text-slate-500">Deductions</p>
                  <p className="text-lg font-semibold tabular-nums">${runDetail.totalDeductions.toLocaleString()}</p>
                </div>
                <div className="rounded-lg bg-indigo-50 p-3 dark:bg-indigo-950">
                  <p className="text-xs text-indigo-600">Total net</p>
                  <p className="text-lg font-semibold tabular-nums text-indigo-700">${runDetail.totalNet.toLocaleString()}</p>
                </div>
              </div>
              <DataTable columns={slipColumns} data={runDetail.slips as Array<PayrollRunDetail['slips'][0] & Record<string, unknown>>} />
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardBody className="p-5">
              <h3 className="mb-4 font-semibold">Payroll run history</h3>
              {isLoading ? (
                <div className="h-48 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
              ) : runs.length === 0 ? (
                <div className="py-12 text-center">
                  <DollarSign className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                  <p className="font-medium">No payroll runs yet</p>
                  <p className="mt-1 text-sm text-slate-500">Run your first payroll to generate payslips.</p>
                  <Button className="mt-4" size="sm" onClick={() => setShowRunModal(true)}>
                    Run payroll
                  </Button>
                </div>
              ) : (
                <DataTable columns={historyColumns} data={runs} />
              )}
            </CardBody>
          </Card>
        )}
      </ResponsiveContainer>

      <ModalRoot open={showRunModal} onOpenChange={setShowRunModal}>
        <ModalContent size="md">
          <ModalHeader>
            <ModalTitle>Run payroll</ModalTitle>
          </ModalHeader>
          <ModalBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                Month
                <select
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={runMonth}
                  onChange={(e) => setRunMonth(parseInt(e.target.value, 10))}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2000, i, 1).toLocaleDateString(undefined, { month: 'long' })}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Year
                <select
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={runYear}
                  onChange={(e) => setRunYear(parseInt(e.target.value, 10))}
                >
                  {[runYear - 1, runYear, runYear + 1].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </label>
            </div>
            {estimate && (
              <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                <p className="text-sm text-slate-600">
                  <strong>{estimate.employeeCount}</strong> employees · Est. net{' '}
                  <strong>${estimate.estimatedTotalNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                </p>
                {estimate.warnings.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-amber-600">
                    {estimate.warnings.map((w) => (
                      <li key={w}>⚠ {w}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setShowRunModal(false)}>Cancel</Button>
            <Button loading={running} onClick={handleRunPayroll}>
              Confirm & run
            </Button>
          </ModalFooter>
        </ModalContent>
      </ModalRoot>
    </div>
  )
}
