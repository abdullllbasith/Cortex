'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { PageHeader, Card, CardBody, Button, Badge, toast } from '@/components/ui'
import { swrFetcher } from '@/lib/api/apiClient'
import { adminFetch, formatDate } from '@/lib/admin/adminUi'

export function AdminAnnouncementsClient() {
  const { data: announcements = [], mutate, isLoading } = useSWR<Array<{
    id: string
    title: string
    body: string
    type: string
    isActive: boolean
    createdAt: string
    createdBy: { fullName: string }
  }>>('/admin/announcements', swrFetcher)

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [type, setType] = useState<'FEATURE' | 'MAINTENANCE' | 'URGENT'>('FEATURE')
  const [loading, setLoading] = useState(false)

  async function send() {
    if (!title.trim() || !body.trim()) return
    setLoading(true)
    try {
      const res = await adminFetch('announcements', {
        method: 'POST',
        body: JSON.stringify({ title, body, type }),
      })
      if (res.success) {
        toast.success('Announcement sent')
        setTitle('')
        setBody('')
        mutate()
      } else toast.error(res.error?.message ?? 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Announcements"
        subtitle="Broadcast messages to tenant owners"
        breadcrumbs={[{ label: 'Admin' }, { label: 'Announcements' }]}
      />
      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <Card>
          <CardBody className="space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold">New announcement</h2>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              placeholder="Message body"
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
            >
              <option value="FEATURE">Feature</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="URGENT">Urgent</option>
            </select>
            <Button loading={loading} onClick={() => void send()}>
              Send to all tenants
            </Button>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-6">
            <h2 className="font-display text-lg font-semibold">History</h2>
            <ul className="mt-4 space-y-3">
              {isLoading ? (
                <li className="text-sm text-slate-500">Loading…</li>
              ) : (
                announcements.map((a) => (
                  <li key={a.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{a.title}</p>
                      <Badge variant="outline">{a.type}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">{a.body}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      {a.createdBy.fullName} · {formatDate(a.createdAt)}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
