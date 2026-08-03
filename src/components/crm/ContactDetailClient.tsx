'use client'

import { useCallback, useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  ArrowLeft,
  Mail,
  Phone,
  MessageCircle,
  Plus,
  Bot,
  Sparkles,
  FileText,
  Calendar,
  CheckCircle2,
  Circle,
  X,
  Zap,
  Filter,
} from 'lucide-react'
import {
  PageHeader,
  Button,
  Card,
  CardBody,
  Badge,
  Avatar,
  Input,
  toast,
  Toggle,
  ModalRoot,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
} from '@/components/ui'
import { swrFetcher, apiClient } from '@/lib/api/apiClient'

type Tab = 'overview' | 'activities' | 'deals' | 'files'

type AddressFields = {
  street?: string
  city?: string
  state?: string
  country?: string
  postal?: string
}

interface ContactDetail {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  mobile: string | null
  company: string | null
  jobTitle: string | null
  type: 'CUSTOMER' | 'LEAD' | 'PROSPECT'
  source: string
  tags: string[]
  notes: string | null
  address: AddressFields
  customFields: Record<string, string>
  doNotContact: boolean
  isActive: boolean
  nextFollowUpAt: string | null
  lastContactedAt: string | null
  owner: { id: string; fullName: string; avatarUrl: string | null; email: string | null } | null
}

interface ActivityItem {
  id: string
  type: string
  subject: string
  description: string | null
  outcome: string | null
  duration: number | null
  scheduledAt: string | null
  completedAt: string | null
  isCompleted: boolean
  createdAt: string
  creator: { id?: string; fullName: string } | null
  assignee: { id?: string; fullName: string } | null
}

interface DealItem {
  id: string
  title: string
  stageId: string
  stageName: string
  pipelineId: string
  stages: Array<{ id: string; name: string }>
  status: string
  value: number
  currency: string
  probability: number
  expectedCloseDate: string | null
  wonAt: string | null
  lostAt: string | null
  lostReason: string | null
  pipelineName: string
  owner: { fullName: string; avatarUrl: string | null } | null
}

interface ContactInsights {
  summary: string
  nextBestAction: string
  source: 'ai' | 'heuristic'
}

interface RepUser {
  id: string
  fullName: string
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'activities', label: 'Activities' },
  { id: 'deals', label: 'Deals' },
  { id: 'files', label: 'Files' },
]

const TYPE_VARIANT: Record<ContactDetail['type'], 'default' | 'info' | 'success' | 'warning'> = {
  CUSTOMER: 'success',
  LEAD: 'info',
  PROSPECT: 'warning',
}

const LIFECYCLE_STAGES = ['LEAD', 'PROSPECT', 'CUSTOMER', 'CHAMPION'] as const

const ACTIVITY_TYPES = [
  { id: 'NOTE', label: 'Note', icon: FileText, color: 'bg-slate-100 text-slate-600' },
  { id: 'CALL', label: 'Call', icon: Phone, color: 'bg-green-100 text-green-700' },
  { id: 'EMAIL', label: 'Email', icon: Mail, color: 'bg-blue-100 text-blue-700' },
  { id: 'MEETING', label: 'Meeting', icon: Calendar, color: 'bg-purple-100 text-purple-700' },
  { id: 'TASK', label: 'Task', icon: CheckCircle2, color: 'bg-amber-100 text-amber-700' },
  { id: 'WHATSAPP', label: 'WhatsApp', icon: MessageCircle, color: 'bg-emerald-100 text-emerald-700' },
  { id: 'DEMO', label: 'Demo', icon: Sparkles, color: 'bg-indigo-100 text-indigo-700' },
] as const

const ACTIVITY_ICONS: Record<string, typeof FileText> = Object.fromEntries(
  ACTIVITY_TYPES.map((t) => [t.id, t.icon]),
)

const OUTCOME_VARIANT: Record<string, 'success' | 'warning' | 'default'> = {
  positive: 'success',
  completed: 'success',
  negative: 'warning',
  no_answer: 'warning',
}

function formatDate(v: string | null) {
  if (!v) return '—'
  return new Date(v).toLocaleString()
}

function parseAddress(raw: unknown): AddressFields {
  if (!raw || typeof raw !== 'object') return {}
  return raw as AddressFields
}

function parseCustomFields(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    out[k] = v != null ? String(v) : ''
  }
  return out
}

function lifecycleIndex(contact: ContactDetail): number {
  if (contact.tags.some((t) => t.toLowerCase() === 'champion')) return 3
  if (contact.type === 'CUSTOMER') return 2
  if (contact.type === 'PROSPECT') return 1
  return 0
}

function EditableField({
  label,
  value,
  onSave,
  type = 'text',
}: {
  label: string
  value: string
  onSave: (v: string) => Promise<void>
  type?: 'text' | 'email' | 'tel'
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (draft === value) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await onSave(draft)
      setEditing(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
      setDraft(value)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="group rounded-lg border border-transparent px-2 py-1.5 hover:border-slate-200 dark:hover:border-slate-700">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      {editing ? (
        <Input
          autoFocus
          type={type}
          value={draft}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void save()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save()
            if (e.key === 'Escape') {
              setDraft(value)
              setEditing(false)
            }
          }}
          className="mt-1 h-8 text-sm"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(value)
            setEditing(true)
          }}
          className="mt-0.5 block w-full text-left text-sm text-slate-800 dark:text-slate-100"
        >
          {value || '—'}
        </button>
      )}
    </div>
  )
}

export function ContactDetailClient({ contactId }: { contactId: string }) {
  const [tab, setTab] = useState<Tab>('overview')
  const [tagInput, setTagInput] = useState('')
  const [activityOpen, setActivityOpen] = useState(false)
  const [customKey, setCustomKey] = useState('')
  const [customValue, setCustomValue] = useState('')
  const [activityFilters, setActivityFilters] = useState({
    type: '',
    assigneeId: '',
    dateFrom: '',
    dateTo: '',
  })
  const [activityForm, setActivityForm] = useState({
    type: 'NOTE',
    subject: '',
    description: '',
    outcome: '',
    duration: '',
    scheduleFollowUp: false,
    followUpDate: '',
    followUpAssignee: '',
  })

  const { data: contactRaw, mutate, isLoading } = useSWR<ContactDetail>(
    `/crm/contacts/${contactId}`,
    swrFetcher,
  )

  const contact = useMemo(() => {
    if (!contactRaw) return null
    return {
      ...contactRaw,
      address: parseAddress(contactRaw.address),
      customFields: parseCustomFields(contactRaw.customFields),
    }
  }, [contactRaw])

  const activityQuery = useMemo(() => {
    const p = new URLSearchParams()
    if (activityFilters.type) p.set('type', activityFilters.type)
    if (activityFilters.assigneeId) p.set('assigneeId', activityFilters.assigneeId)
    if (activityFilters.dateFrom) p.set('dateFrom', activityFilters.dateFrom)
    if (activityFilters.dateTo) p.set('dateTo', activityFilters.dateTo)
    const q = p.toString()
    return q ? `?${q}` : ''
  }, [activityFilters])

  const { data: activitiesData, mutate: mutateActivities } = useSWR<{ items: ActivityItem[] }>(
    tab === 'activities' || tab === 'overview'
      ? `/crm/contacts/${contactId}/activities${activityQuery}`
      : null,
    swrFetcher,
  )

  const { data: dealsData, mutate: mutateDeals } = useSWR<{ open: DealItem[]; history: DealItem[] }>(
    tab === 'deals' || tab === 'overview' ? `/crm/contacts/${contactId}/deals` : null,
    swrFetcher,
  )

  const { data: insights } = useSWR<ContactInsights>(
    tab === 'overview' ? `/crm/contacts/${contactId}/summary` : null,
    swrFetcher,
  )

  const { data: repsData } = useSWR<{ items: RepUser[] }>(
    activityOpen || tab === 'overview' ? '/crm/reps' : null,
    swrFetcher,
  )

  const reps = repsData?.items ?? []
  const fullName = contact ? `${contact.firstName} ${contact.lastName}`.trim() : ''
  const phone = contact?.mobile || contact?.phone
  const waLink = phone && !contact?.doNotContact ? `https://wa.me/${phone.replace(/\D/g, '')}` : null

  const saveField = useCallback(
    async (field: string, value: unknown) => {
      await apiClient.put(`/crm/contacts/${contactId}`, { [field]: value })
      toast.success('Saved')
      mutate()
    },
    [contactId, mutate],
  )

  const saveAddress = async (key: keyof AddressFields, value: string) => {
    if (!contact) return
    const next = { ...contact.address, [key]: value || undefined }
    await saveField('address', next)
  }

  const addTag = async () => {
    const tag = tagInput.trim()
    if (!tag || !contact) return
    if (contact.tags.includes(tag)) {
      setTagInput('')
      return
    }
    await saveField('tags', [...contact.tags, tag])
    setTagInput('')
  }

  const removeTag = async (tag: string) => {
    if (!contact) return
    await saveField('tags', contact.tags.filter((t) => t !== tag))
  }

  const addCustomField = async () => {
    const key = customKey.trim()
    if (!key || !contact) return
    await saveField('customFields', { ...contact.customFields, [key]: customValue })
    setCustomKey('')
    setCustomValue('')
  }

  const removeCustomField = async (key: string) => {
    if (!contact) return
    const next = { ...contact.customFields }
    delete next[key]
    await saveField('customFields', next)
  }

  const submitActivity = async () => {
    if (!activityForm.subject.trim()) {
      toast.error('Subject is required')
      return
    }
    await apiClient.post(`/crm/contacts/${contactId}/activities`, {
      type: activityForm.type,
      subject: activityForm.subject,
      description: activityForm.description || null,
      outcome: activityForm.outcome || null,
      duration: activityForm.duration ? Number(activityForm.duration) : null,
      isCompleted: true,
      completedAt: new Date().toISOString(),
    })
    if (activityForm.scheduleFollowUp && activityForm.followUpDate) {
      await apiClient.put(`/crm/contacts/${contactId}`, {
        nextFollowUpAt: new Date(activityForm.followUpDate).toISOString(),
        ...(activityForm.followUpAssignee && { ownerId: activityForm.followUpAssignee }),
      })
      await apiClient.post(`/crm/contacts/${contactId}/activities`, {
        type: 'TASK',
        subject: 'Follow-up scheduled',
        description: `Follow up on ${activityForm.followUpDate}`,
        scheduledAt: new Date(activityForm.followUpDate).toISOString(),
        assignedTo: activityForm.followUpAssignee || null,
        isCompleted: false,
      })
    }
    toast.success('Activity logged')
    setActivityOpen(false)
    setActivityForm({
      type: 'NOTE',
      subject: '',
      description: '',
      outcome: '',
      duration: '',
      scheduleFollowUp: false,
      followUpDate: '',
      followUpAssignee: '',
    })
    mutateActivities()
    mutate()
  }

  const moveDealStage = async (dealId: string, stageId: string) => {
    await apiClient.post(`/crm/deals/${dealId}/move`, { stageId })
    toast.success('Deal stage updated')
    mutateDeals()
  }

  const handleDoIt = () => {
    const action = insights?.nextBestAction?.toLowerCase() ?? ''
    if (action.includes('call') && phone) {
      window.location.href = `tel:${phone}`
      return
    }
    if (action.includes('email') && contact?.email) {
      window.location.href = `mailto:${contact.email}`
      return
    }
    if (waLink && (action.includes('whatsapp') || action.includes('message'))) {
      window.open(waLink, '_blank')
      return
    }
    setActivityForm((f) => ({ ...f, scheduleFollowUp: true, subject: insights?.nextBestAction ?? 'Follow up' }))
    setActivityOpen(true)
  }

  const activities = activitiesData?.items ?? []
  const openDeals = dealsData?.open ?? []
  const historyDeals = dealsData?.history ?? []
  const lifeIdx = contact ? lifecycleIndex(contact) : 0

  if (isLoading && !contact) {
    return <div className="flex h-48 items-center justify-center text-sm text-slate-500">Loading contact…</div>
  }

  if (!contact) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2 text-sm text-slate-500">
        <p>Contact not found</p>
        <Link href="/crm/contacts"><Button size="sm" variant="secondary">Back to contacts</Button></Link>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-gradient-to-b from-slate-50/80 to-white px-6 py-6 dark:border-slate-800 dark:from-slate-900/50 dark:to-slate-950">
        <div className="mb-4 flex items-start justify-between gap-4">
          <Link href="/crm/contacts" className="text-sm text-slate-500 hover:text-indigo-600">
            <ArrowLeft className="mr-1 inline h-4 w-4" />
            Contacts
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {waLink && (
              <a href={waLink} target="_blank" rel="noreferrer">
                <Button size="sm"><MessageCircle className="mr-1 h-4 w-4" />WhatsApp</Button>
              </a>
            )}
            {contact.email && !contact.doNotContact && (
              <a href={`mailto:${contact.email}`}>
                <Button variant="secondary" size="sm"><Mail className="mr-1 h-4 w-4" />Email</Button>
              </a>
            )}
            {phone && (
              <a href={`tel:${phone}`}>
                <Button variant="secondary" size="sm"><Phone className="mr-1 h-4 w-4" />Call</Button>
              </a>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar name={fullName} size="xl" className="h-20 w-20 text-2xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{fullName}</h1>
              <Badge variant={TYPE_VARIANT[contact.type]}>{contact.type}</Badge>
              {!contact.isActive && <Badge variant="warning">Inactive</Badge>}
              {contact.doNotContact && <Badge variant="warning">Do Not Contact</Badge>}
            </div>
            {contact.company && <p className="text-slate-600 dark:text-slate-400">{contact.company}</p>}
            {contact.jobTitle && <p className="text-sm text-slate-500">{contact.jobTitle}</p>}
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">Active</span>
              <Toggle
                checked={contact.isActive}
                onCheckedChange={(v) => void saveField('isActive', v)}
                aria-label="Active status"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">Do not contact</span>
              <Toggle
                checked={contact.doNotContact}
                onCheckedChange={(v) => void saveField('doNotContact', v)}
                aria-label="Do not contact"
              />
            </div>
          </div>
        </div>

        <div className="mt-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Lifecycle</p>
          <div className="flex items-center gap-1">
            {LIFECYCLE_STAGES.map((stage, i) => (
              <div key={stage} className="flex flex-1 items-center">
                <div
                  className={`flex h-8 flex-1 items-center justify-center rounded-md text-xs font-medium ${
                    i <= lifeIdx
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                  }`}
                >
                  {stage.charAt(0) + stage.slice(1).toLowerCase()}
                </div>
                {i < LIFECYCLE_STAGES.length - 1 && (
                  <div className={`mx-0.5 h-0.5 w-2 shrink-0 ${i < lifeIdx ? 'bg-indigo-400' : 'bg-slate-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex gap-1 border-b border-slate-200 dark:border-slate-700">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'border-b-2 border-indigo-600 text-indigo-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'overview' && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <Card>
                <CardBody className="p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Personal</h3>
                  <div className="grid gap-1 sm:grid-cols-2">
                    <EditableField label="First name" value={contact.firstName} onSave={(v) => saveField('firstName', v)} />
                    <EditableField label="Last name" value={contact.lastName} onSave={(v) => saveField('lastName', v)} />
                    <EditableField label="Email" value={contact.email ?? ''} type="email" onSave={(v) => saveField('email', v)} />
                    <EditableField label="Phone" value={contact.phone ?? ''} type="tel" onSave={(v) => saveField('phone', v)} />
                    <EditableField label="Mobile" value={contact.mobile ?? ''} type="tel" onSave={(v) => saveField('mobile', v)} />
                    <EditableField label="Job title" value={contact.jobTitle ?? ''} onSave={(v) => saveField('jobTitle', v)} />
                    <EditableField label="Company" value={contact.company ?? ''} onSave={(v) => saveField('company', v)} />
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardBody className="p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Address</h3>
                  <div className="grid gap-1 sm:grid-cols-2">
                    <EditableField label="Street" value={contact.address.street ?? ''} onSave={(v) => saveAddress('street', v)} />
                    <EditableField label="City" value={contact.address.city ?? ''} onSave={(v) => saveAddress('city', v)} />
                    <EditableField label="State" value={contact.address.state ?? ''} onSave={(v) => saveAddress('state', v)} />
                    <EditableField label="Country" value={contact.address.country ?? ''} onSave={(v) => saveAddress('country', v)} />
                    <EditableField label="Postal" value={contact.address.postal ?? ''} onSave={(v) => saveAddress('postal', v)} />
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardBody className="p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Custom fields</h3>
                  <div className="space-y-2">
                    {Object.entries(contact.customFields).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                        <span className="font-medium text-slate-500">{key}</span>
                        <span>{val || '—'}</span>
                        <button type="button" onClick={() => void removeCustomField(key)} aria-label={`Remove ${key}`}>
                          <X className="h-4 w-4 text-slate-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Input placeholder="Key" value={customKey} onChange={(e) => setCustomKey(e.target.value)} className="h-8 max-w-[120px] text-sm" />
                    <Input placeholder="Value" value={customValue} onChange={(e) => setCustomValue(e.target.value)} className="h-8 flex-1 text-sm" />
                    <Button size="sm" variant="secondary" onClick={() => void addCustomField()}>Add</Button>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardBody className="p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {contact.tags.map((tag) => (
                      <Badge key={tag} variant="default" className="gap-1 pr-1">
                        {tag}
                        <button type="button" onClick={() => void removeTag(tag)} aria-label={`Remove ${tag}`}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Input
                      placeholder="Add tag…"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void addTag()}
                      className="h-8 max-w-xs text-sm"
                    />
                    <Button size="sm" variant="secondary" onClick={() => void addTag()}>Add</Button>
                  </div>
                </CardBody>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="border-indigo-100 bg-indigo-50/30 dark:border-indigo-900 dark:bg-indigo-950/20">
                <CardBody className="p-4">
                  <div className="mb-2 flex items-center gap-2 text-indigo-600">
                    <Bot className="h-4 w-4" />
                    <span className="text-sm font-semibold">AI Summary</span>
                    {insights?.source === 'ai' && <Badge variant="info" size="sm">SalesAgent</Badge>}
                  </div>
                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    {insights?.summary ?? 'Generating summary…'}
                  </p>
                </CardBody>
              </Card>

              <Card>
                <CardBody className="p-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Next best action</p>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {insights?.nextBestAction ?? 'Analyzing contact…'}
                  </p>
                  <Button size="sm" className="mt-3" onClick={handleDoIt}>
                    <Zap className="mr-1 h-4 w-4" />
                    Do it
                  </Button>
                </CardBody>
              </Card>

              <Card>
                <CardBody className="space-y-3 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Next follow-up</p>
                  <Input
                    type="datetime-local"
                    defaultValue={
                      contact.nextFollowUpAt
                        ? new Date(contact.nextFollowUpAt).toISOString().slice(0, 16)
                        : ''
                    }
                    onBlur={(e) => {
                      const v = e.target.value
                      void saveField('nextFollowUpAt', v ? new Date(v).toISOString() : null)
                    }}
                    className="h-9 text-sm"
                  />
                  <select
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                    value={contact.owner?.id ?? ''}
                    onChange={(e) => void saveField('ownerId', e.target.value || null)}
                  >
                    <option value="">Unassigned</option>
                    {reps.map((r) => (
                      <option key={r.id} value={r.id}>{r.fullName}</option>
                    ))}
                  </select>
                </CardBody>
              </Card>

              {openDeals.length > 0 && (
                <Card>
                  <CardBody className="p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Open pipeline</p>
                    <p className="text-2xl font-semibold text-indigo-600">
                      ${openDeals.reduce((s, d) => s + d.value, 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500">{openDeals.length} open deal(s)</p>
                  </CardBody>
                </Card>
              )}
            </div>
          </div>
        )}

        {tab === 'activities' && (
          <div className="relative max-w-3xl">
            <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                className="h-9 rounded-lg border border-slate-200 px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={activityFilters.type}
                onChange={(e) => setActivityFilters((f) => ({ ...f, type: e.target.value }))}
              >
                <option value="">All types</option>
                {ACTIVITY_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
              <select
                className="h-9 rounded-lg border border-slate-200 px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={activityFilters.assigneeId}
                onChange={(e) => setActivityFilters((f) => ({ ...f, assigneeId: e.target.value }))}
              >
                <option value="">All assignees</option>
                {reps.map((r) => (
                  <option key={r.id} value={r.id}>{r.fullName}</option>
                ))}
              </select>
              <Input type="date" value={activityFilters.dateFrom} onChange={(e) => setActivityFilters((f) => ({ ...f, dateFrom: e.target.value }))} className="h-9 w-36 text-sm" />
              <Input type="date" value={activityFilters.dateTo} onChange={(e) => setActivityFilters((f) => ({ ...f, dateTo: e.target.value }))} className="h-9 w-36 text-sm" />
            </div>

            <div className="space-y-4">
              {activities.length === 0 ? (
                <p className="text-sm text-slate-500">No activities match your filters.</p>
              ) : (
                activities.map((a) => {
                  const meta = ACTIVITY_TYPES.find((t) => t.id === a.type)
                  const Icon = ACTIVITY_ICONS[a.type] ?? Circle
                  const outcomeKey = a.outcome?.toLowerCase().replace(/\s/g, '_') ?? ''
                  return (
                    <div key={a.id} className="flex gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${meta?.color ?? 'bg-slate-100'}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 border-b border-slate-100 pb-4 dark:border-slate-800">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{a.subject}</span>
                          {a.outcome && (
                            <Badge variant={OUTCOME_VARIANT[outcomeKey] ?? 'default'} size="sm">
                              {a.outcome}
                            </Badge>
                          )}
                        </div>
                        {a.description && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{a.description}</p>}
                        <p className="mt-1 text-xs text-slate-400">
                          {formatDate(a.createdAt)}
                          {a.creator?.fullName && ` · ${a.creator.fullName}`}
                          {a.assignee?.fullName && ` · assigned ${a.assignee.fullName}`}
                          {a.duration != null && ` · ${a.duration} min`}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <button
              type="button"
              onClick={() => setActivityOpen(true)}
              className="fixed bottom-8 right-8 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700"
              aria-label="Log activity"
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>
        )}

        {tab === 'deals' && (
          <div className="space-y-8">
            <section>
              <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Open deals</h3>
              {openDeals.length === 0 ? (
                <p className="text-sm text-slate-500">No open deals for this contact.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {openDeals.map((d) => (
                    <Card key={d.id}>
                      <CardBody className="space-y-2 p-4">
                        <p className="font-medium">{d.title}</p>
                        <p className="text-xs text-slate-500">{d.pipelineName} · {d.stageName}</p>
                        <p className="text-lg font-semibold text-indigo-600">
                          {d.currency} {d.value.toLocaleString()}
                        </p>
                        <Badge variant="info" size="sm">{d.probability}%</Badge>
                        {d.expectedCloseDate && (
                          <p className="text-xs text-slate-500">
                            Close: {new Date(d.expectedCloseDate).toLocaleDateString()}
                          </p>
                        )}
                        <select
                          className="mt-2 h-8 w-full rounded-lg border border-slate-200 px-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                          value={d.stageId}
                          onChange={(e) => void moveDealStage(d.id, e.target.value)}
                        >
                          {d.stages.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              )}
            </section>
            <section>
              <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Won / lost history</h3>
              {historyDeals.length === 0 ? (
                <p className="text-sm text-slate-500">No closed deals yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900">
                      <tr>
                        <th className="px-4 py-2">Deal</th>
                        <th className="px-4 py-2">Stage</th>
                        <th className="px-4 py-2">Value</th>
                        <th className="px-4 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyDeals.map((d) => (
                        <tr key={d.id} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="px-4 py-3 font-medium">{d.title}</td>
                          <td className="px-4 py-3 text-slate-500">{d.stageName}</td>
                          <td className="px-4 py-3 tabular-nums">{d.currency} {d.value.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <Badge variant={d.status === 'WON' ? 'success' : 'warning'}>{d.status}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {tab === 'files' && (
          <div className="flex h-48 flex-col items-center justify-center text-sm text-slate-500">
            <FileText className="mb-2 h-8 w-8 opacity-40" />
            <p>No files attached to this contact.</p>
            <p className="text-xs">Document storage integration coming soon.</p>
          </div>
        )}
      </div>

      <ModalRoot open={activityOpen} onOpenChange={setActivityOpen}>
        <ModalContent size="md">
          <ModalHeader>
            <ModalTitle>Log activity</ModalTitle>
          </ModalHeader>
          <ModalBody className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-500">Type</label>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {ACTIVITY_TYPES.map((t) => {
                  const Icon = t.icon
                  const selected = activityForm.type === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActivityForm((f) => ({ ...f, type: t.id }))}
                      className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-xs ${
                        selected ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <Input
              placeholder="Subject"
              value={activityForm.subject}
              onChange={(e) => setActivityForm((f) => ({ ...f, subject: e.target.value }))}
            />
            <textarea
              placeholder="Description"
              value={activityForm.description}
              onChange={(e) => setActivityForm((f) => ({ ...f, description: e.target.value }))}
              className="min-h-[80px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
            <Input
              placeholder="Outcome (optional)"
              value={activityForm.outcome}
              onChange={(e) => setActivityForm((f) => ({ ...f, outcome: e.target.value }))}
            />
            {activityForm.type === 'CALL' && (
              <Input
                type="number"
                placeholder="Duration (minutes)"
                value={activityForm.duration}
                onChange={(e) => setActivityForm((f) => ({ ...f, duration: e.target.value }))}
              />
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={activityForm.scheduleFollowUp}
                onChange={(e) => setActivityForm((f) => ({ ...f, scheduleFollowUp: e.target.checked }))}
              />
              Schedule follow-up
            </label>
            {activityForm.scheduleFollowUp && (
              <>
                <Input
                  type="datetime-local"
                  value={activityForm.followUpDate}
                  onChange={(e) => setActivityForm((f) => ({ ...f, followUpDate: e.target.value }))}
                />
                <select
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={activityForm.followUpAssignee}
                  onChange={(e) => setActivityForm((f) => ({ ...f, followUpAssignee: e.target.value }))}
                >
                  <option value="">Assign to…</option>
                  {reps.map((r) => (
                    <option key={r.id} value={r.id}>{r.fullName}</option>
                  ))}
                </select>
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setActivityOpen(false)}>Cancel</Button>
            <Button onClick={() => void submitActivity()}>Save activity</Button>
          </ModalFooter>
        </ModalContent>
      </ModalRoot>
    </div>
  )
}
