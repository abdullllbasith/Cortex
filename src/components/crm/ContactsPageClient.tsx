'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  LayoutGrid,
  List,
  Mail,
  Phone,
  Building2,
  Clock,
  User,
  Users,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import {
  PageHeader,
  Badge,
  Card,
  CardBody,
  Avatar,
  Button,
  Input,
} from '@/components/ui'
import { DataTable, type ColumnDef } from '@/components/data/DataTable'
import { swrFetcher } from '@/lib/api/apiClient'

type ContactSegment = 'all' | 'mine' | 'new' | 'overdue' | 'high_value'

interface ContactListItem extends Record<string, unknown> {
  id: string
  firstName: string
  lastName: string
  fullName: string
  email: string | null
  phone: string | null
  company: string | null
  type: 'CUSTOMER' | 'LEAD' | 'PROSPECT'
  source: string
  tags: string[]
  nextFollowUpAt: string | null
  lastContactedAt: string | null
  createdAt: string
  openDealValue: number
  dealCount?: number
  owner: { id: string; fullName: string; avatarUrl: string | null } | null
}

interface ContactsResponse {
  items: ContactListItem[]
}

const SEGMENTS: Array<{ id: ContactSegment; label: string; icon: typeof Users; description: string }> = [
  { id: 'all', label: 'All contacts', icon: Users, description: 'Every active contact' },
  { id: 'mine', label: 'My contacts', icon: User, description: 'Assigned to you' },
  { id: 'new', label: 'New this week', icon: Sparkles, description: 'Created in the last 7 days' },
  { id: 'overdue', label: 'Overdue follow-up', icon: AlertCircle, description: 'Past follow-up date' },
  { id: 'high_value', label: 'High value', icon: Building2, description: 'Top 20% by open deal value' },
]

const TYPE_VARIANT: Record<ContactListItem['type'], 'default' | 'info' | 'success' | 'warning'> = {
  CUSTOMER: 'success',
  LEAD: 'info',
  PROSPECT: 'warning',
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString()
}

function ContactCard({ contact }: { contact: ContactListItem }) {
  const overdue = contact.nextFollowUpAt && new Date(contact.nextFollowUpAt) < new Date()

  return (
    <Card className="border-slate-200 transition-shadow hover:shadow-md">
      <CardBody className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <Avatar name={contact.fullName} src={contact.owner?.avatarUrl ?? undefined} size="sm" />
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-100">{contact.fullName}</p>
              {contact.company && (
                <p className="text-xs text-slate-500">{contact.company}</p>
              )}
            </div>
          </div>
          <Badge variant={TYPE_VARIANT[contact.type]} size="sm">{contact.type}</Badge>
        </div>
        <div className="space-y-1 text-xs text-slate-500">
          {contact.email && (
            <p className="inline-flex items-center gap-1.5">
              <Mail className="h-3 w-3" /> {contact.email}
            </p>
          )}
          {contact.phone && (
            <p className="inline-flex items-center gap-1.5">
              <Phone className="h-3 w-3" /> {contact.phone}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between text-xs">
          {contact.openDealValue > 0 ? (
            <span className="font-medium text-indigo-600">
              ${contact.openDealValue.toLocaleString()} · {contact.dealCount ?? 0} deal(s)
            </span>
          ) : (
            <span className="text-slate-400">No open deals</span>
          )}
          {contact.nextFollowUpAt && (
            <span className={`inline-flex items-center gap-1 ${overdue ? 'text-red-500' : 'text-slate-500'}`}>
              <Clock className="h-3 w-3" />
              {formatDate(contact.nextFollowUpAt)}
            </span>
          )}
        </div>
        {contact.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {contact.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="default" size="sm">{tag}</Badge>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  )
}

export function ContactsPageClient() {
  const [segment, setSegment] = useState<ContactSegment>('all')
  const [view, setView] = useState<'table' | 'cards'>('table')
  const [search, setSearch] = useState('')

  const queryKey = useMemo(() => {
    const params = new URLSearchParams()
    if (segment !== 'all') params.set('segment', segment)
    if (search) params.set('search', search)
    const qs = params.toString()
    return `/crm/contacts${qs ? `?${qs}` : ''}`
  }, [segment, search])

  const { data, isLoading } = useSWR<ContactsResponse>(queryKey, swrFetcher)
  const items = data?.items ?? []

  const columns: ColumnDef<ContactListItem>[] = useMemo(
    () => [
      {
        id: 'name',
        header: 'Contact',
        cell: ({ row }) => (
          <Link href={`/crm/contacts/${row.id}`} className="flex items-center gap-2 hover:opacity-90">
            <Avatar name={row.fullName} src={row.owner?.avatarUrl ?? undefined} size="xs" />
            <div>
              <p className="font-medium text-indigo-600">{row.fullName}</p>
              {row.company && <p className="text-xs text-slate-500">{row.company}</p>}
            </div>
          </Link>
        ),
      },
      {
        id: 'type',
        header: 'Type',
        cell: ({ row }) => <Badge variant={TYPE_VARIANT[row.type]} size="sm">{row.type}</Badge>,
      },
      {
        id: 'email',
        header: 'Email',
        cell: ({ row }) => row.email ?? '—',
      },
      {
        id: 'owner',
        header: 'Owner',
        cell: ({ row }) => row.owner?.fullName ?? '—',
      },
      {
        id: 'pipeline',
        header: 'Open value',
        cell: ({ row }) =>
          row.openDealValue > 0 ? `$${row.openDealValue.toLocaleString()}` : '—',
      },
      {
        id: 'followUp',
        header: 'Next follow-up',
        cell: ({ row }) => {
          const overdue = row.nextFollowUpAt && new Date(row.nextFollowUpAt) < new Date()
          return (
            <span className={overdue ? 'text-red-500 font-medium' : ''}>
              {formatDate(row.nextFollowUpAt)}
            </span>
          )
        },
      },
      {
        id: 'created',
        header: 'Created',
        cell: ({ row }) => formatDate(row.createdAt),
      },
    ],
    [],
  )

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Contacts"
        subtitle="Manage leads, prospects, and customers"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'CRM', href: '/crm' },
          { label: 'Contacts' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                className={`rounded-l-lg px-2.5 py-1.5 ${view === 'table' ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
                onClick={() => setView('table')}
                aria-label="Table view"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={`rounded-r-lg px-2.5 py-1.5 ${view === 'cards' ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
                onClick={() => setView('cards')}
                aria-label="Card view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
            <Link href="/crm/pipeline">
              <Button variant="secondary" size="sm">View pipeline</Button>
            </Link>
          </div>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50 lg:block">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Segments</p>
          <nav className="space-y-1">
            {SEGMENTS.map(({ id, label, icon: Icon, description }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSegment(id)}
                className={`flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  segment === id
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <span className="inline-flex items-center gap-2 font-medium">
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
                <span className="mt-0.5 text-xs text-slate-400">{description}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex flex-1 flex-col overflow-hidden p-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="lg:hidden">
              <select
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={segment}
                onChange={(e) => setSegment(e.target.value as ContactSegment)}
              >
                {SEGMENTS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
            <Input
              placeholder="Search contacts (semantic)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <span className="text-sm text-slate-500">{items.length} contact(s)</span>
          </div>

          {isLoading ? (
            <div className="flex h-48 items-center justify-center text-sm text-slate-500">Loading contacts…</div>
          ) : items.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-sm text-slate-500">
              <p>No contacts match this segment.</p>
              <p className="text-xs">Create contacts via the API or import from your knowledge base.</p>
            </div>
          ) : view === 'table' ? (
            <DataTable columns={columns} data={items} keyField="id" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((contact) => (
                <Link key={contact.id} href={`/crm/contacts/${contact.id}`}>
                  <ContactCard contact={contact} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
