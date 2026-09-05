'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Copy, Plus, Send, Trash2, Webhook } from 'lucide-react'
import {
  PageHeader,
  Button,
  Badge,
  Input,
  ModalRoot,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalTitle,
  Card,
  CardBody,
} from '@/components/ui'
import { swrFetcher, authFetch } from '@/lib/api/apiClient'
import { toast } from '@/components/ui'
import { formatDistanceToNow } from 'date-fns'

interface WebhookRow {
  id: string
  url: string
  secret: string
  events: string[]
  isActive: boolean
  lastDeliveryAt: string | null
  successRate: number
  createdAt: string
}

interface DeliveryRow {
  id: string
  eventType: string
  statusCode: number | null
  responseTimeMs: number | null
  success: boolean
  createdAt: string
  payload: Record<string, unknown>
}

export default function WebhooksSettingsPage() {
  const { data, mutate } = useSWR<{
    webhooks: WebhookRow[]
    eventGroups: Record<string, string[]>
  }>('/settings/webhooks', swrFetcher)

  const [showAdd, setShowAdd] = useState(false)
  const [url, setUrl] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])
  const [createdSecret, setCreatedSecret] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { data: deliveryData, mutate: mutateDeliveries } = useSWR<{ deliveries: DeliveryRow[] }>(
    expandedId ? `/settings/webhooks?webhookId=${expandedId}` : null,
    swrFetcher,
  )

  const webhooks = data?.webhooks ?? []
  const eventGroups = data?.eventGroups ?? {}

  async function createWebhook() {
    const res = await authFetch('/api/settings/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ url, events: selectedEvents }),
    })
    const json = await res.json()
    if (json.success) {
      setCreatedSecret(json.data.secret)
      setShowAdd(false)
      setUrl('')
      setSelectedEvents([])
      mutate()
      toast.success('Webhook endpoint created')
    }
  }

  async function deleteWebhook(id: string) {
    await authFetch(`/api/settings/webhooks?id=${id}`, { method: 'DELETE', credentials: 'include' })
    mutate()
    toast.success('Webhook deleted')
  }

  async function testWebhook(id: string) {
    const res = await authFetch('/api/settings/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'test', webhookId: id }),
    })
    const json = await res.json()
    if (json.success) {
      toast.success(json.data.success ? 'Test delivery succeeded' : 'Test delivery failed')
      mutate()
      if (expandedId === id) mutateDeliveries()
    }
  }

  async function retryDelivery(deliveryId: string) {
    await authFetch('/api/settings/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'retry', deliveryId }),
    })
    mutateDeliveries()
    toast.success('Retry queued')
  }

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Webhooks"
        subtitle="Send real-time events to your external systems"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Settings', href: '/settings' },
          { label: 'Webhooks' },
        ]}
        actions={
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add endpoint
          </Button>
        }
      />

      <div className="p-6 max-w-5xl space-y-4">
        {webhooks.length === 0 ? (
          <Card>
            <CardBody className="py-12 text-center text-slate-500">
              <Webhook className="h-10 w-10 mx-auto mb-3 opacity-40" />
              No webhook endpoints configured
            </CardBody>
          </Card>
        ) : (
          webhooks.map((wh) => (
            <Card key={wh.id}>
              <CardBody className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-sm font-medium truncate">{wh.url}</code>
                      <Badge variant={wh.isActive ? 'success' : 'default'}>{wh.isActive ? 'Active' : 'Inactive'}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {(wh.events as string[]).length} events · Success rate {wh.successRate.toFixed(0)}%
                      {wh.lastDeliveryAt && ` · Last delivery ${formatDistanceToNow(new Date(wh.lastDeliveryAt), { addSuffix: true })}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => void testWebhook(wh.id)}>
                      <Send className="h-3.5 w-3.5 mr-1" /> Test
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setExpandedId(expandedId === wh.id ? null : wh.id)}>
                      Log
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void deleteWebhook(wh.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>

                {expandedId === wh.id && (
                  <div className="mt-4 border-t pt-4">
                    <p className="text-xs font-medium text-slate-500 mb-2">Recent deliveries</p>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {(deliveryData?.deliveries ?? []).map((d) => (
                        <div key={d.id} className="flex items-center justify-between text-xs rounded-lg border p-2">
                          <div>
                            <span className="font-medium">{d.eventType}</span>
                            <span className="text-slate-500 ml-2">{d.statusCode ?? '—'} · {d.responseTimeMs ?? 0}ms</span>
                            <Badge variant={d.success ? 'success' : 'danger'} size="sm" className="ml-2">
                              {d.success ? 'OK' : 'Failed'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400">{formatDistanceToNow(new Date(d.createdAt), { addSuffix: true })}</span>
                            {!d.success && (
                              <Button variant="ghost" size="sm" onClick={() => void retryDelivery(d.id)}>Retry</Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          ))
        )}
      </div>

      <ModalRoot open={showAdd} onOpenChange={setShowAdd}>
        <ModalContent size="lg">
          <ModalHeader><ModalTitle>Add webhook endpoint</ModalTitle></ModalHeader>
          <ModalBody className="space-y-4">
            <Input label="Endpoint URL" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.example.com/webhooks/saios" />
            <div>
              <p className="text-sm font-medium mb-2">Events</p>
              {Object.entries(eventGroups).map(([group, events]) => (
                <div key={group} className="mb-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">{group}</p>
                  <div className="grid sm:grid-cols-2 gap-1">
                    {events.map((ev) => (
                      <label key={ev} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={selectedEvents.includes(ev)}
                          onChange={(e) =>
                            setSelectedEvents((s) =>
                              e.target.checked ? [...s, ev] : s.filter((x) => x !== ev),
                            )
                          }
                        />
                        {ev}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={() => void createWebhook()} disabled={!url || selectedEvents.length === 0}>
              Create endpoint
            </Button>
          </ModalFooter>
        </ModalContent>
      </ModalRoot>

      <ModalRoot open={!!createdSecret} onOpenChange={() => setCreatedSecret(null)}>
        <ModalContent>
          <ModalHeader><ModalTitle>Webhook secret</ModalTitle></ModalHeader>
          <ModalBody>
            <p className="text-sm text-slate-600 mb-2">Copy your signing secret — used to verify payloads.</p>
            <div className="flex gap-2 p-3 rounded-lg bg-slate-100 dark:bg-slate-800">
              <code className="text-xs flex-1 break-all">{createdSecret}</code>
              <Button variant="ghost" size="sm" onClick={() => createdSecret && navigator.clipboard.writeText(createdSecret)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button onClick={() => setCreatedSecret(null)}>Done</Button>
          </ModalFooter>
        </ModalContent>
      </ModalRoot>
    </div>
  )
}
