'use client'

import { useState, useCallback } from 'react'
import useSWR from 'swr'
import {
  Copy,
  Check,
  MessageCircle,
  Hash,
  Mail,
  MessageSquare,
  Smartphone,
  Send,
  ExternalLink,
} from 'lucide-react'
import { PageHeader, Button, Badge, Input, ModalRoot, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalTitle } from '@/components/ui'
import { apiClient, swrFetcher } from '@/lib/api/apiClient'
import { cn } from '@/lib/utils'
import { toast } from '@/components/ui'

interface ChannelConfig {
  channel: string
  enabled: boolean
  webhookUrl: string
  config: Record<string, unknown>
}

type ChannelKey = 'whatsapp' | 'slack' | 'email' | 'teams' | 'sms'

const CHANNEL_META: Record<ChannelKey, { label: string; description: string; icon: typeof Mail; color: string }> = {
  whatsapp: {
    label: 'WhatsApp Business',
    description: 'Send and receive WhatsApp messages via Meta Business API',
    icon: MessageCircle,
    color: 'text-green-600 bg-green-50 dark:bg-green-950/40',
  },
  slack: {
    label: 'Slack',
    description: 'DMs, @mentions, and slash commands in your workspace',
    icon: Hash,
    color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40',
  },
  email: {
    label: 'Email (SendGrid)',
    description: 'Inbound parse and outbound transactional email',
    icon: Mail,
    color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40',
  },
  teams: {
    label: 'Microsoft Teams',
    description: 'Bot notifications and adaptive cards in Teams channels',
    icon: MessageSquare,
    color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40',
  },
  sms: {
    label: 'SMS (Twilio)',
    description: 'Text message alerts and two-way SMS conversations',
    icon: Smartphone,
    color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40',
  },
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="p-1.5 rounded-md text-slate-400 hover:text-slate-600"
    >
      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
    </button>
  )
}

export default function ChannelsSettingsPage() {
  const { data: channels = [], mutate, isLoading } = useSWR<ChannelConfig[]>(
    '/settings/channels',
    swrFetcher,
  )
  const [modal, setModal] = useState<ChannelKey | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [phone, setPhone] = useState('')
  const [slackChannel, setSlackChannel] = useState('#general')

  const channelMap = Object.fromEntries(channels.map((c) => [c.channel, c]))

  const allChannels: ChannelKey[] = ['whatsapp', 'slack', 'email', 'teams', 'sms']

  const connect = useCallback(async (channel: ChannelKey, enabled: boolean, config?: Record<string, unknown>) => {
    setSaving(channel)
    try {
      await apiClient.put('/settings/channels', { channel, enabled, config })
      mutate()
      toast.success(`${CHANNEL_META[channel].label} ${enabled ? 'connected' : 'disconnected'}`)
      if (!enabled) setModal(null)
    } catch {
      toast.error('Failed to update channel')
    } finally {
      setSaving(null)
    }
  }, [mutate])

  const ch = modal ? channelMap[modal] : null

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Channels"
        subtitle="Connect messaging channels to SAIOS"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Settings', href: '/settings' },
          { label: 'Channels' },
        ]}
      />

      <div className="p-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 max-w-6xl">
        {isLoading && <p className="text-sm text-slate-400 col-span-full">Loading…</p>}
        {allChannels.map((key) => {
          const meta = CHANNEL_META[key]
          const Icon = meta.icon
          const cfg = channelMap[key]
          const connected = cfg?.enabled ?? false
          const isApiChannel = ['whatsapp', 'slack', 'email'].includes(key)

          return (
            <div
              key={key}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 flex flex-col"
            >
              <div className="flex items-start gap-3 mb-3">
                <span className={cn('p-2.5 rounded-lg shrink-0', meta.color)}>
                  <Icon className="w-5 h-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">{meta.label}</h3>
                    <Badge variant={connected ? 'success' : 'default'} size="sm">
                      {connected ? 'Connected' : 'Not connected'}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">{meta.description}</p>
                </div>
              </div>

              {connected && cfg && (
                <div className="text-xs text-slate-500 mb-3 space-y-1">
                  <p>Account: {(cfg.config.accountName as string) ?? 'Configured'}</p>
                  <p>Last activity: {(cfg.config.lastMessageAt as string) ?? '—'}</p>
                </div>
              )}

              <div className="mt-auto flex gap-2 pt-2">
                {connected ? (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => toast.success('Test message queued')}>
                      <Send className="h-3.5 w-3.5 mr-1" /> Test
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={saving === key}
                      onClick={() => isApiChannel ? void connect(key, false) : toast.info('Coming soon')}
                    >
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => (isApiChannel ? setModal(key) : toast.info(`${meta.label} integration coming soon`))}
                  >
                    Connect
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <ModalRoot open={modal === 'whatsapp'} onOpenChange={(o) => !o && setModal(null)}>
        <ModalContent size="lg">
          <ModalHeader><ModalTitle>Connect WhatsApp</ModalTitle></ModalHeader>
          <ModalBody className="space-y-4">
            <ol className="list-decimal list-inside text-sm text-slate-600 space-y-2">
              <li>Register your phone number in Meta Business Manager</li>
              <li>Copy the webhook URL below into Meta&apos;s callback URL field</li>
              <li>Set verify token to your <code className="text-xs">WHATSAPP_VERIFY_TOKEN</code></li>
            </ol>
            <Input label="Business phone number" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 0100" />
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Webhook URL</p>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border">
                <code className="text-xs flex-1 truncate">{ch?.webhookUrl}</code>
                {ch?.webhookUrl && <CopyButton text={ch.webhookUrl} />}
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
            <Button loading={saving === 'whatsapp'} onClick={() => void connect('whatsapp', true, { phone, accountName: phone })}>
              Connect WhatsApp
            </Button>
          </ModalFooter>
        </ModalContent>
      </ModalRoot>

      <ModalRoot open={modal === 'slack'} onOpenChange={(o) => !o && setModal(null)}>
        <ModalContent>
          <ModalHeader><ModalTitle>Connect Slack</ModalTitle></ModalHeader>
          <ModalBody className="space-y-4">
            <Button variant="secondary" className="w-full" onClick={() => toast.info('Slack OAuth — configure SLACK_BOT_TOKEN in env')}>
              <ExternalLink className="h-4 w-4 mr-2" /> Authorize with Slack
            </Button>
            <Input label="Notification channel" value={slackChannel} onChange={(e) => setSlackChannel(e.target.value)} />
            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border">
              <code className="text-xs flex-1 truncate">{ch?.webhookUrl}</code>
              {ch?.webhookUrl && <CopyButton text={ch.webhookUrl} />}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button loading={saving === 'slack'} onClick={() => void connect('slack', true, { channel: slackChannel, accountName: slackChannel })}>
              Save connection
            </Button>
          </ModalFooter>
        </ModalContent>
      </ModalRoot>

      <ModalRoot open={modal === 'email'} onOpenChange={(o) => !o && setModal(null)}>
        <ModalContent size="lg">
          <ModalHeader><ModalTitle>Connect Email</ModalTitle></ModalHeader>
          <ModalBody className="space-y-4 text-sm">
            <p className="text-slate-600">Configure SendGrid Inbound Parse to forward emails to SAIOS.</p>
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Inbound webhook URL</p>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border">
                <code className="text-xs flex-1 truncate">{ch?.webhookUrl}</code>
                {ch?.webhookUrl && <CopyButton text={ch.webhookUrl} />}
              </div>
            </div>
            <div className="rounded-lg border p-3 bg-slate-50 dark:bg-slate-900">
              <p className="font-medium mb-1">DKIM setup</p>
              <p className="text-xs text-slate-500">Add CNAME records from SendGrid domain authentication to improve deliverability.</p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button loading={saving === 'email'} onClick={() => void connect('email', true, { accountName: 'SendGrid' })}>
              Connect email
            </Button>
          </ModalFooter>
        </ModalContent>
      </ModalRoot>
    </div>
  )
}
