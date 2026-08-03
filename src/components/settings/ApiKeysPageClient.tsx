'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Copy, Key, Trash2, ExternalLink } from 'lucide-react'
import {
  PageHeader,
  Button,
  Card,
  CardBody,
  Input,
  Badge,
  ModalRoot,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalTitle,
} from '@/components/ui'
import { swrFetcher } from '@/lib/api/apiClient'
import { ALL_PERMISSIONS } from '@/lib/auth/permissions'

interface ApiKeyRow {
  id: string
  name: string
  lastFourChars: string
  permissions: string[]
  lastUsedAt?: string | null
  expiresAt?: string | null
  createdAt: string
  isActive: boolean
}

export function ApiKeysPageClient() {
  const { data: keys = [], mutate, isLoading } = useSWR<ApiKeyRow[]>('/settings/api-keys', swrFetcher)
  const { data: usageData } = useSWR<{ usage: Record<string, unknown>[]; keys: string[] }>(
    '/settings/api-keys/usage',
    swrFetcher,
  )

  const [name, setName] = useState('')
  const [selected, setSelected] = useState<string[]>([ALL_PERMISSIONS[0]])
  const [expiresAt, setExpiresAt] = useState('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)

  async function createKey() {
    setLoading(true)
    try {
      const res = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          permissions: selected,
          ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
        }),
      })
      const json = await res.json()
      if (json.success) {
        setCreatedKey(json.data.rawKey)
        setShowModal(true)
        setName('')
        setExpiresAt('')
        mutate()
      }
    } finally {
      setLoading(false)
    }
  }

  async function revoke(id: string) {
    if (!confirm('Revoke this API key?')) return
    await fetch(`/api/settings/api-keys?id=${id}`, { method: 'DELETE', credentials: 'include' })
    mutate()
  }

  const chartData = usageData?.usage ?? []

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="API Keys"
        subtitle="Programmatic access with scoped permissions"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Settings', href: '/settings' },
          { label: 'API Keys' },
        ]}
      />

      <div className="flex-1 space-y-6 overflow-auto p-6 max-w-5xl">
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4 text-sm">
          <p className="text-slate-600 dark:text-slate-400">
            Rate limits vary by plan. See{' '}
            <a href="/settings/billing" className="text-indigo-600 inline-flex items-center gap-1">
              billing <ExternalLink className="h-3 w-3" />
            </a>{' '}
            for your current limits.
          </p>
        </div>

        <Card>
          <CardBody className="space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold">Create API key</h2>
            <Input label="Key name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Production integration" />
            <Input label="Expiry date (optional)" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            <div>
              <p className="mb-2 text-sm font-medium">Permission scopes</p>
              <div className="grid max-h-40 gap-2 overflow-y-auto sm:grid-cols-2">
                {ALL_PERMISSIONS.map((p) => (
                  <label key={p} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={selected.includes(p)}
                      onChange={(e) =>
                        setSelected((s) => (e.target.checked ? [...s, p] : s.filter((x) => x !== p)))
                      }
                    />
                    {p}
                  </label>
                ))}
              </div>
            </div>
            <Button variant="primary" onClick={createKey} loading={loading} disabled={!name || selected.length === 0}>
              Generate key
            </Button>
          </CardBody>
        </Card>

        {chartData.length > 0 && (
          <Card>
            <CardBody className="p-6">
              <h2 className="font-semibold mb-4">API calls (last 30 days)</h2>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.slice(-14)}>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    {(usageData?.keys ?? []).slice(0, 3).map((k, i) => (
                      <Bar key={k} dataKey={k} fill={['#4F46E5', '#0EA5E9', '#10B981'][i]} stackId="a" />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardBody className="p-0 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Key</th>
                  <th className="px-4 py-3 text-left">Permissions</th>
                  <th className="px-4 py-3 text-left">Created</th>
                  <th className="px-4 py-3 text-left">Last used</th>
                  <th className="px-4 py-3 text-left">Expiry</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-500">Loading…</td></tr>
                )}
                {keys.map((k) => (
                  <tr key={k.id} className="border-b border-slate-100 dark:border-slate-800/60">
                    <td className="px-4 py-3 font-medium">{k.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">••••{k.lastFourChars}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[180px]">
                        {k.permissions.slice(0, 2).map((p) => (
                          <Badge key={p} variant="outline">{p}</Badge>
                        ))}
                        {k.permissions.length > 2 && (
                          <Badge variant="outline">+{k.permissions.length - 2}</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{new Date(k.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={k.isActive ? 'success' : 'default'}>{k.isActive ? 'Active' : 'Revoked'}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm" onClick={() => revoke(k.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {!isLoading && keys.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      <Key className="mx-auto mb-2 h-8 w-8 opacity-40" />
                      No API keys yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardBody>
        </Card>
      </div>

      <ModalRoot open={showModal} onOpenChange={setShowModal}>
        <ModalContent>
          <ModalHeader><ModalTitle>Save your API key</ModalTitle></ModalHeader>
          <ModalBody>
            <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
              Save this key — it won&apos;t be shown again.
            </p>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-100 dark:bg-slate-800">
              <code className="text-xs flex-1 break-all font-mono">{createdKey}</code>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  if (createdKey) await navigator.clipboard.writeText(createdKey)
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button onClick={() => setShowModal(false)}>Done</Button>
          </ModalFooter>
        </ModalContent>
      </ModalRoot>
    </div>
  )
}
