'use client'

import { useCallback, useMemo, useState } from 'react'
import useSWR from 'swr'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Calendar, GripVertical, Plus, TrendingUp } from 'lucide-react'
import {
  PageHeader,
  Badge,
  Card,
  CardBody,
  Avatar,
  Button,
  Input,
  toast,
  ModalRoot,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
  ModalClose,
} from '@/components/ui'
import { swrFetcher } from '@/lib/api/apiClient'
import { apiClient } from '@/lib/api/apiClient'
import type { PipelineStage } from '@/lib/crm/crmSchemas'

interface PipelineRecord {
  id: string
  name: string
  isDefault: boolean
  stages: PipelineStage[]
}

interface DealRecord {
  id: string
  title: string
  stageId: string
  pipelineId: string
  value: number
  currency: string
  probability: number
  expectedCloseDate: string | null
  daysInStage: number
  contact: { firstName: string; lastName: string } | null
  company: { name: string } | null
  owner: { fullName: string; avatarUrl: string | null } | null
}

interface PipelineSummary {
  totalValue: number
  weightedValue: number
  dealCount: number
  dealsByStage: Array<{ stageId: string; count: number; value: number }>
}

function formatCurrency(value: number, currency = 'USD') {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
}

function DealCardContent({ deal, dragging }: { deal: DealRecord; dragging?: boolean }) {
  const contactName = deal.contact
    ? `${deal.contact.firstName} ${deal.contact.lastName}`.trim()
    : 'No contact'

  return (
    <Card className={`cursor-grab border-slate-200 shadow-sm ${dragging ? 'opacity-90 ring-2 ring-indigo-400' : ''}`}>
      <CardBody className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{deal.title}</p>
            <p className="truncate text-xs text-slate-500">{contactName}</p>
            {deal.company && <p className="truncate text-xs text-slate-400">{deal.company.name}</p>}
          </div>
          <GripVertical className="h-4 w-4 shrink-0 text-slate-300" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-indigo-600">{formatCurrency(deal.value, deal.currency)}</span>
          <Badge variant="info" size="sm">{deal.probability}%</Badge>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {deal.expectedCloseDate
              ? new Date(deal.expectedCloseDate).toLocaleDateString()
              : 'No close date'}
          </span>
          <span>{deal.daysInStage}d in stage</span>
        </div>
        {deal.owner && (
          <div className="flex items-center gap-2 pt-1">
            <Avatar name={deal.owner.fullName} src={deal.owner.avatarUrl ?? undefined} size="xs" />
            <span className="truncate text-xs text-slate-500">{deal.owner.fullName}</span>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

function DraggableDeal({ deal, onOpen }: { deal: DealRecord; onOpen: (deal: DealRecord) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id })
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'opacity-40' : ''}>
      <div {...listeners} {...attributes}>
        <button type="button" className="w-full text-left" onClick={() => onOpen(deal)}>
          <DealCardContent deal={deal} />
        </button>
      </div>
    </div>
  )
}

function StageColumn({
  stage,
  deals,
  stageStats,
  onAddDeal,
  onOpenDeal,
}: {
  stage: PipelineStage
  deals: DealRecord[]
  stageStats?: { count: number; value: number }
  onAddDeal: (stageId: string) => void
  onOpenDeal: (deal: DealRecord) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div
        className="mb-3 rounded-lg px-3 py-2"
        style={{ backgroundColor: `${stage.color}22`, borderLeft: `3px solid ${stage.color}` }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{stage.name}</h3>
          <Badge variant="default" size="sm">{stageStats?.count ?? deals.length}</Badge>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          {formatCurrency(stageStats?.value ?? deals.reduce((s, d) => s + d.value, 0))}
        </p>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-[420px] flex-1 flex-col gap-2 rounded-xl border border-dashed p-2 transition-colors ${
          isOver ? 'border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20' : 'border-slate-200 dark:border-slate-700'
        }`}
      >
        {deals.map((deal) => (
          <DraggableDeal key={deal.id} deal={deal} onOpen={onOpenDeal} />
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full border border-dashed"
          onClick={() => onAddDeal(stage.id)}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add deal
        </Button>
      </div>
    </div>
  )
}

interface DealDetail extends DealRecord {
  notes?: string | null
}

export function PipelineKanbanClient() {
  const [activeDeal, setActiveDeal] = useState<DealRecord | null>(null)
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null)
  const [ownerFilter, setOwnerFilter] = useState('')
  const [valueMin, setValueMin] = useState('')
  const [valueMax, setValueMax] = useState('')
  const [closeFrom, setCloseFrom] = useState('')
  const [closeTo, setCloseTo] = useState('')
  const [drawerDeal, setDrawerDeal] = useState<DealDetail | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editValue, setEditValue] = useState('')
  const [addStageId, setAddStageId] = useState<string | null>(null)
  const [newDealTitle, setNewDealTitle] = useState('')
  const [newDealValue, setNewDealValue] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: pipelineData, mutate: mutatePipelines } = useSWR<{ items: PipelineRecord[] }>(
    '/crm/pipelines?seed=true',
    swrFetcher,
  )

  const pipelines = pipelineData?.items ?? []
  const activePipeline = useMemo(() => {
    if (selectedPipelineId) return pipelines.find((p) => p.id === selectedPipelineId)
    return pipelines.find((p) => p.isDefault) ?? pipelines[0]
  }, [pipelines, selectedPipelineId])

  const pipelineId = activePipeline?.id

  const dealsQuery = useMemo(() => {
    if (!pipelineId) return null
    const p = new URLSearchParams({ pipelineId })
    if (ownerFilter) p.set('ownerId', ownerFilter)
    if (valueMin) p.set('valueMin', valueMin)
    if (valueMax) p.set('valueMax', valueMax)
    if (closeFrom) p.set('closeFrom', closeFrom)
    if (closeTo) p.set('closeTo', closeTo)
    return `/crm/deals?${p.toString()}`
  }, [pipelineId, ownerFilter, valueMin, valueMax, closeFrom, closeTo])

  const { data: dealsData, mutate: mutateDeals, isLoading } = useSWR<{ items: DealRecord[] }>(
    dealsQuery,
    swrFetcher,
  )

  const { data: teamData } = useSWR<{ members: Array<{ id: string; fullName: string }> }>(
    '/settings/team',
    swrFetcher,
  )

  const { data: summary } = useSWR<PipelineSummary>(
    pipelineId ? `/crm/deals?summary=true&pipelineId=${pipelineId}` : null,
    swrFetcher,
  )

  const deals = dealsData?.items ?? []
  const stages = useMemo(
    () => (activePipeline?.stages ?? []).slice().sort((a, b) => a.order - b.order),
    [activePipeline],
  )

  const dealsByStage = useMemo(() => {
    const map = new Map<string, DealRecord[]>()
    for (const stage of stages) map.set(stage.id, [])
    for (const deal of deals) {
      const list = map.get(deal.stageId) ?? []
      list.push(deal)
      map.set(deal.stageId, list)
    }
    return map
  }, [deals, stages])

  const stageStatsMap = useMemo(() => {
    const map = new Map<string, { count: number; value: number }>()
    for (const s of summary?.dealsByStage ?? []) {
      map.set(s.stageId, { count: s.count, value: s.value })
    }
    return map
  }, [summary])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const deal = deals.find((d) => d.id === event.active.id)
      if (deal) setActiveDeal(deal)
    },
    [deals],
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveDeal(null)
      const { active, over } = event
      if (!over || active.id === over.id) return

      const dealId = String(active.id)
      const newStageId = String(over.id)
      const deal = deals.find((d) => d.id === dealId)
      if (!deal || deal.stageId === newStageId) return

      const previous = deals
      const optimistic = deals.map((d) =>
        d.id === dealId ? { ...d, stageId: newStageId, daysInStage: 0 } : d,
      )
      void mutateDeals({ items: optimistic }, false)

      try {
        await apiClient.post(`/crm/deals/${dealId}/move`, { stageId: newStageId })
        await mutateDeals()
        await mutatePipelines()
      } catch (err) {
        void mutateDeals({ items: previous }, false)
        toast.error(err instanceof Error ? err.message : 'Failed to move deal')
      }
    },
    [deals, mutateDeals, mutatePipelines],
  )

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Pipeline"
        subtitle="Drag deals between stages to update progress"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'CRM', href: '/crm' },
          { label: 'Pipeline' },
        ]}
        actions={
          pipelines.length > 1 ? (
            <select
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              value={activePipeline?.id ?? ''}
              onChange={(e) => setSelectedPipelineId(e.target.value)}
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          ) : undefined
        }
      />

      {summary && (
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-3 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <TrendingUp className="h-4 w-4 text-indigo-500" />
              <strong>{formatCurrency(summary.totalValue)}</strong> total pipeline
            </span>
            <span className="text-slate-500">
              Weighted: <strong className="text-slate-700 dark:text-slate-200">{formatCurrency(summary.weightedValue)}</strong>
            </span>
            <span className="text-slate-500">{summary.dealCount} open deals</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 px-6 py-3 dark:border-slate-800">
        <div>
          <label className="text-xs text-slate-500">Owner</label>
          <select
            className="mt-0.5 block h-9 min-w-[140px] rounded-lg border px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
          >
            <option value="">All owners</option>
            {(teamData?.members ?? []).map((m) => (
              <option key={m.id} value={m.id}>{m.fullName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">Min value</label>
          <Input type="number" className="h-9 w-24" value={valueMin} onChange={(e) => setValueMin(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-500">Max value</label>
          <Input type="number" className="h-9 w-24" value={valueMax} onChange={(e) => setValueMax(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-500">Close from</label>
          <Input type="date" className="h-9" value={closeFrom} onChange={(e) => setCloseFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-500">Close to</label>
          <Input type="date" className="h-9" value={closeTo} onChange={(e) => setCloseTo(e.target.value)} />
        </div>
      </div>

      <div className="flex-1 overflow-x-auto p-6">
        {isLoading && !deals.length ? (
          <div className="flex h-48 items-center justify-center text-sm text-slate-500">Loading pipeline…</div>
        ) : !stages.length ? (
          <div className="flex h-48 flex-col items-center justify-center gap-3 text-sm text-slate-500">
            <p>No pipeline configured yet.</p>
            <Button size="sm" onClick={() => mutatePipelines()}>Initialize pipelines</Button>
          </div>
        ) : (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex gap-4 pb-4">
              {stages.filter((s) => !['won', 'lost'].includes(s.id)).map((stage) => (
                <StageColumn
                  key={stage.id}
                  stage={stage}
                  deals={dealsByStage.get(stage.id) ?? []}
                  stageStats={stageStatsMap.get(stage.id)}
                  onAddDeal={(stageId) => {
                    setAddStageId(stageId)
                    setNewDealTitle('')
                    setNewDealValue('')
                  }}
                  onOpenDeal={async (deal) => {
                    setDrawerDeal(deal)
                    setEditTitle(deal.title)
                    setEditValue(String(deal.value))
                    try {
                      const detail = await apiClient.get<DealDetail>(`/crm/deals/${deal.id}`)
                      setDrawerDeal({ ...deal, ...detail })
                      setEditTitle(detail.title)
                      setEditValue(String(detail.value ?? deal.value))
                    } catch {
                      /* use list data */
                    }
                  }}
                />
              ))}
            </div>
            <DragOverlay>
              {activeDeal ? <DealCardContent deal={activeDeal} dragging /> : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  )
}
