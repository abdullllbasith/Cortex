'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { GitBranch, Plus, Trash2 } from 'lucide-react'
import useSWR from 'swr'
import { PageHeader, Button, Badge, Skeleton, Modal, ConfirmDialog, toast } from '@/components/ui'
import { swrFetcher, apiClient } from '@/lib/api/apiClient'
import { ApiError } from '@/lib/api/types'
import { queryKeys } from '@/lib/api/queryKeys'
import { LazyWorkflowAnalytics } from '@/lib/lazy/components'
import { useRouter } from 'next/navigation'
import { Toggle } from '@/components/ui'
import {
  CROSS_MODULE_TEMPLATE_IDS,
  type WorkflowTemplateSummary,
} from '@/lib/workflows/templates/index'

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

function groupTemplatesByCategory(templates: WorkflowTemplateSummary[]) {
  const groups = new Map<string, WorkflowTemplateSummary[]>()
  for (const template of templates) {
    const list = groups.get(template.category) ?? []
    list.push(template)
    groups.set(template.category, list)
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
}

function TemplateCard({
  template,
  creating,
  highlighted,
  onSelect,
}: {
  template: WorkflowTemplateSummary
  creating: boolean
  highlighted?: boolean
  onSelect: (id: string) => void
}) {
  return (
    <button
      type="button"
      disabled={creating}
      onClick={() => onSelect(template.id)}
      className={
        highlighted
          ? 'text-left rounded-lg border-2 border-indigo-200 p-3 transition-colors hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-indigo-800 dark:hover:bg-indigo-950/20'
          : 'text-left rounded-lg border border-slate-200 p-3 transition-colors hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-slate-700 dark:hover:bg-indigo-950/20'
      }
    >
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{template.name}</p>
      <Badge variant="outline" size="sm" className="mt-1">
        {template.category}
      </Badge>
      <p className="mt-2 line-clamp-3 text-xs text-slate-500">{template.description}</p>
    </button>
  )
}

export default function WorkflowsPageClient() {
  const router = useRouter()
  const [templateOpen, setTemplateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<WorkflowListItem | null>(null)
  const seededRef = useRef(false)

  const { data: workflows = [], isLoading, mutate } = useSWR<WorkflowListItem[]>(
    queryKeys.workflows.list(),
    () => swrFetcher('/workflows'),
  )

  const {
    data: templates = [],
    isLoading: templatesLoading,
    error: templatesError,
  } = useSWR<WorkflowTemplateSummary[]>(
    [...queryKeys.workflows.all, 'templates'],
    () => swrFetcher('/workflows/templates'),
    { revalidateOnFocus: false },
  )

  const { data: analytics, isLoading: analyticsLoading } = useSWR(
    [...queryKeys.workflows.all, 'analytics'],
    () => swrFetcher('/workflows/analytics'),
  )

  useEffect(() => {
    if (seededRef.current) return
    seededRef.current = true
    void apiClient
      .post<{ count: number }>('/workflows/seed-templates')
      .then(() => mutate())
      .catch(() => {
        /* non-blocking bootstrap for existing tenants */
      })
  }, [mutate])

  const crossModuleSet = useMemo(() => new Set<string>(CROSS_MODULE_TEMPLATE_IDS), [])
  const crossModuleTemplates = useMemo(
    () => templates.filter((t) => crossModuleSet.has(t.id)),
    [templates, crossModuleSet],
  )
  const otherTemplates = useMemo(
    () => templates.filter((t) => !crossModuleSet.has(t.id)),
    [templates, crossModuleSet],
  )
  const groupedOther = useMemo(() => groupTemplatesByCategory(otherTemplates), [otherTemplates])

  async function createWorkflow(templateId?: string) {
    setCreating(true)
    try {
      const templateName = templateId
        ? templates.find((t) => t.id === templateId)?.name ?? 'New Workflow'
        : 'Untitled Workflow'
      const wf = await apiClient.post<{ id: string }>('/workflows', {
        name: templateId ? templateName : 'Untitled Workflow',
        templateId,
      })
      setTemplateOpen(false)
      toast.success(templateId ? `Created "${templateName}"` : 'Blank workflow created')
      await mutate()
      router.push(`/workflows/${wf.id}/builder`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create workflow')
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
    <div className="flex h-full flex-col">
      <PageHeader
        title="Workflows"
        subtitle="Automated business process orchestration"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Workflows' }]}
        actions={
          <Button size="sm" onClick={() => setTemplateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> New Workflow
          </Button>
        }
      />

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <LazyWorkflowAnalytics data={analytics as never} loading={analyticsLoading} />

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        ) : workflows.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <GitBranch className="mb-3 h-12 w-12 opacity-40" />
            <p className="mb-4 text-sm">No workflows yet</p>
            <Button size="sm" onClick={() => setTemplateOpen(true)}>
              Create your first workflow
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {workflows.map((wf) => (
              <div
                key={wf.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/workflows/${wf.id}/builder`}
                      className="font-semibold text-slate-900 hover:text-indigo-600 dark:text-slate-100"
                    >
                      {wf.name}
                    </Link>
                    {wf.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{wf.description}</p>
                    )}
                  </div>
                  <Badge variant={wf.isActive ? 'success' : 'default'} size="sm">
                    {wf.triggerType}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{wf.executionCount} runs</span>
                  {wf.lastExecution && (
                    <Badge
                      variant={
                        wf.lastExecution.status === 'COMPLETED'
                          ? 'success'
                          : wf.lastExecution.status === 'FAILED'
                            ? 'danger'
                            : 'warning'
                      }
                      size="sm"
                    >
                      Last: {wf.lastExecution.status}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-800">
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    Active
                    <Toggle checked={wf.isActive} onCheckedChange={() => toggleActive(wf.id, wf.isActive)} />
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(wf)}
                      className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                      aria-label={`Delete ${wf.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                    <Link href={`/workflows/${wf.id}/builder`} className="text-xs text-indigo-600 hover:underline">
                      Edit →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
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
        <div className="max-h-[min(70vh,640px)] overflow-y-auto pr-1">
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Choose from {templates.length || '…'} ready-made automation templates, or start from scratch.
          </p>

          {templatesLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-28 rounded-lg" />
              ))}
            </div>
          ) : templatesError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              Could not load templates. Try again or start with a blank workflow.
            </p>
          ) : (
            <>
              {crossModuleTemplates.length > 0 && (
                <section className="mb-6">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                    Cross-module ERP workflows
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {crossModuleTemplates.map((t) => (
                      <TemplateCard
                        key={t.id}
                        template={t}
                        creating={creating}
                        highlighted
                        onSelect={createWorkflow}
                      />
                    ))}
                  </div>
                </section>
              )}

              {groupedOther.map(([category, items]) => (
                <section key={category} className="mb-6">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {category}
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {items.map((t) => (
                      <TemplateCard
                        key={t.id}
                        template={t}
                        creating={creating}
                        onSelect={createWorkflow}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </>
          )}
        </div>

        <Button
          variant="secondary"
          className="mt-4 w-full"
          disabled={creating}
          onClick={() => createWorkflow()}
        >
          Start blank workflow
        </Button>
      </Modal>
    </div>
  )
}
