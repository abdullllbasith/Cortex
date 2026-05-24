'use client'

import { useState } from 'react'
import Link from 'next/link'
import { GitBranch, Plus, Trash2 } from 'lucide-react'
import useSWR from 'swr'
import { PageHeader, Button, Badge, Skeleton, Modal, ConfirmDialog, toast } from '@/components/ui'
import { swrFetcher, apiClient } from '@/lib/api/apiClient'
import { ApiError } from '@/lib/api/types'
import { queryKeys } from '@/lib/api/queryKeys'
import { WorkflowAnalytics } from '@/components/workflows/WorkflowAnalytics'
import { useRouter } from 'next/navigation'
import { Toggle } from '@/components/ui'

interface WorkflowListItem {
  id: string
  name: string
  description: string | null
  triggerType: string
  isActive: boolean
  status: 'active' | 'draft'
  executionCount: number
  lastExecution: { status: string } | null
  updatedAt: string
}

interface Template {
  id: string
  name: string
  category: string
  description: string
}

export default function WorkflowsPageClient() {
  const router = useRouter()
  const [templateOpen, setTemplateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<WorkflowListItem | null>(null)

  const { data: workflows = [], isLoading, mutate } = useSWR<WorkflowListItem[]>(
    queryKeys.workflows.list(),
    () => swrFetcher('/workflows'),
  )

  const { data: templates = [] } = useSWR<Template[]>(
    [...queryKeys.workflows.all, 'templates'],
    () => swrFetcher('/workflows/templates'),
    { revalidateOnFocus: false },
  )

  const { data: analytics, isLoading: analyticsLoading } = useSWR(
    [...queryKeys.workflows.all, 'analytics'],
    () => swrFetcher('/workflows/analytics'),
  )

  async function createWorkflow(templateId?: string) {
    setCreating(true)
    try {
      const wf = await apiClient.post<{ id: string }>('/workflows', {
        name: templateId ? templates.find((t) => t.id === templateId)?.name ?? 'New Workflow' : 'Untitled Workflow',
        templateId,
      })
      setTemplateOpen(false)
      router.push(`/workflows/${wf.id}/builder`)
    } finally {
      setCreating(false)
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    await apiClient.post(`/workflows/${id}/activate`, { isActive: !isActive })
    mutate()
  }

  async function deleteWorkflow() {
    if (!deleteTarget) return
    try {
      await apiClient.delete(`/workflows/${deleteTarget.id}`)
      toast.success(`Deleted "${deleteTarget.name}"`)
      setDeleteTarget(null)
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete workflow')
      throw err
    }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Workflows"
        subtitle="Automated business process orchestration"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Workflows' }]}
        actions={
          <Button size="sm" onClick={() => setTemplateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Workflow
          </Button>
        }
      />

      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        <WorkflowAnalytics data={analytics as never} loading={analyticsLoading} />

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
          </div>
        ) : workflows.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <GitBranch className="h-12 w-12 mb-3 opacity-40" />
            <p className="text-sm mb-4">No workflows yet</p>
            <Button size="sm" onClick={() => setTemplateOpen(true)}>Create your first workflow</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows.map((wf) => (
              <div key={wf.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link href={`/workflows/${wf.id}/builder`} className="font-semibold text-slate-900 dark:text-slate-100 hover:text-indigo-600">
                      {wf.name}
                    </Link>
                    {wf.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{wf.description}</p>}
                  </div>
                  <Badge variant={wf.isActive ? 'success' : 'default'} size="sm">{wf.triggerType}</Badge>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{wf.executionCount} runs</span>
                  {wf.lastExecution && (
                    <Badge variant={wf.lastExecution.status === 'COMPLETED' ? 'success' : wf.lastExecution.status === 'FAILED' ? 'danger' : 'warning'} size="sm">
                      Last: {wf.lastExecution.status}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    Active
                    <Toggle checked={wf.isActive} onCheckedChange={() => toggleActive(wf.id, wf.isActive)} />
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(wf)}
                      className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      aria-label={`Delete ${wf.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                    <Link href={`/workflows/${wf.id}/builder`} className="text-xs text-indigo-600 hover:underline">Edit →</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="Delete workflow?"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" and its execution history will be permanently removed. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={deleteWorkflow}
      />

      <Modal open={templateOpen} onOpenChange={setTemplateOpen} title="New Workflow" size="lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={creating}
              onClick={() => createWorkflow(t.id)}
              className="text-left rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors"
            >
              <p className="text-sm font-semibold">{t.name}</p>
              <Badge variant="outline" size="sm" className="mt-1">{t.category}</Badge>
              <p className="text-xs text-slate-500 mt-2 line-clamp-2">{t.description}</p>
            </button>
          ))}
        </div>
        <Button variant="secondary" className="w-full" disabled={creating} onClick={() => createWorkflow()}>
          Start blank workflow
        </Button>
      </Modal>
    </div>
  )
}
