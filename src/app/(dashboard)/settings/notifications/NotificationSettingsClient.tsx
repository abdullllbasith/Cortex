'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Bell, Hash, Mail, MessageCircle, Send } from 'lucide-react'
import { PageHeader, Button, Toggle, Skeleton } from '@/components/ui'
import { swrFetcher, authFetch } from '@/lib/api/apiClient'
import { queryKeys } from '@/lib/api/queryKeys'
import type { NotificationPreferenceDTO } from '@/lib/notifications/types'
import { NOTIFICATION_TEMPLATES } from '@/lib/notifications/notificationTemplates'
import type { NotificationType } from '@prisma/client'

const TYPE_SECTIONS: { title: string; description: string; types: NotificationType[] }[] = [
  {
    title: 'Alerts',
    description: 'Prediction and inventory alerts from the AI engine',
    types: ['ALERT'],
  },
  {
    title: 'Workflows',
    description: 'Workflow failures and automation notifications',
    types: ['SYSTEM'],
  },
  {
    title: 'Security',
    description: 'Login events and security incidents',
    types: ['SECURITY'],
  },
  {
    title: 'Billing',
    description: 'Payments, renewals, and subscription updates',
    types: ['BILLING'],
  },
  {
    title: 'Activity',
    description: 'Team activity and mentions',
    types: ['ACTIVITY', 'MENTION', 'REMINDER'],
  },
]

export default function NotificationSettingsClient() {
  const { data: prefs = [], isLoading, mutate } = useSWR<NotificationPreferenceDTO[]>(
    queryKeys.notifications.preferences(),
    () => swrFetcher('/notifications/preferences'),
  )
  const [local, setLocal] = useState<NotificationPreferenceDTO[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const rows = local ?? prefs

  function updatePref(type: NotificationType, patch: Partial<NotificationPreferenceDTO>) {
    setLocal(
      rows.map((p) => (p.notificationType === type ? { ...p, ...patch } : p)),
    )
  }

  async function save() {
    setSaving(true)
    try {
      await authFetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ preferences: rows }),
      })
      setLocal(null)
      void mutate()
    } finally {
      setSaving(false)
    }
  }

  async function sendTest() {
    setTesting(true)
    try {
      await authFetch('/api/notifications/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ test: true }),
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Notification preferences"
        subtitle="Choose how and when you receive alerts across channels"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Settings', href: '/settings' },
          { label: 'Notifications' },
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => void sendTest()} disabled={testing}>
              <Send className="h-4 w-4 mr-1" />
              Test notification
            </Button>
            <Button size="sm" onClick={() => void save()} disabled={saving || !local}>
              Save changes
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 max-w-4xl space-y-8">
        {isLoading ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : (
          TYPE_SECTIONS.map((section) => (
            <section key={section.title} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{section.title}</h2>
              <p className="text-sm text-slate-500 mb-4">{section.description}</p>

              {section.types.map((type) => {
                const pref = rows.find((p) => p.notificationType === type)
                if (!pref) return null
                return (
                  <div key={type} className="border-t border-slate-100 dark:border-slate-800 py-4 first:border-t-0 first:pt-0">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{type}</span>
                      <select
                        value={pref.digest}
                        onChange={(e) =>
                          updatePref(type, {
                            digest: e.target.value as NotificationPreferenceDTO['digest'],
                          })
                        }
                        className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs px-2 py-1"
                      >
                        <option value="IMMEDIATE">Immediate</option>
                        <option value="HOURLY">Hourly digest</option>
                        <option value="DAILY">Daily digest</option>
                        <option value="WEEKLY">Weekly digest</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <ChannelToggle
                        icon={Bell}
                        label="In-app"
                        checked={pref.inApp}
                        onChange={(v) => updatePref(type, { inApp: v })}
                      />
                      <ChannelToggle
                        icon={Mail}
                        label="Email"
                        checked={pref.email}
                        onChange={(v) => updatePref(type, { email: v })}
                      />
                      <ChannelToggle
                        icon={MessageCircle}
                        label="WhatsApp"
                        checked={pref.whatsapp}
                        onChange={(v) => updatePref(type, { whatsapp: v })}
                      />
                      <ChannelToggle
                        icon={Hash}
                        label="Slack"
                        checked={pref.slack}
                        onChange={(v) => updatePref(type, { slack: v })}
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 items-center text-xs text-slate-500">
                      <span>Quiet hours</span>
                      <input
                        type="time"
                        value={pref.quietHoursStart ?? ''}
                        onChange={(e) => updatePref(type, { quietHoursStart: e.target.value || null })}
                        className="rounded border border-slate-200 dark:border-slate-700 px-2 py-1"
                      />
                      <span>to</span>
                      <input
                        type="time"
                        value={pref.quietHoursEnd ?? ''}
                        onChange={(e) => updatePref(type, { quietHoursEnd: e.target.value || null })}
                        className="rounded border border-slate-200 dark:border-slate-700 px-2 py-1"
                      />
                    </div>
                  </div>
                )
              })}
            </section>
          ))
        )}

        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">Email preview</h2>
          <div className="space-y-3">
            {Object.values(NOTIFICATION_TEMPLATES).slice(0, 3).map((t) => (
              <div key={t.key} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                <p className="text-xs font-medium text-indigo-600">{t.key}</p>
                <p className="text-sm font-semibold mt-1">{t.titlePattern}</p>
                <p className="text-xs text-slate-500 mt-1">{t.bodyPattern}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function ChannelToggle({
  icon: Icon,
  label,
  checked,
  onChange,
}: {
  icon: typeof Bell
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2 text-xs">
      <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <Toggle checked={checked} onCheckedChange={onChange} size="sm" />
    </label>
  )
}
