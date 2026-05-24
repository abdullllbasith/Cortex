export type ChannelType = 'web' | 'whatsapp' | 'slack' | 'email'

export interface StandardMessage {
  channel: ChannelType
  tenantId: string
  userId: string
  externalId: string
  text: string
  subject?: string
  attachments?: Array<{
    type: 'image' | 'document' | 'audio' | 'file'
    url?: string
    mimeType?: string
    name?: string
    content?: string
  }>
  metadata?: Record<string, unknown>
  timestamp: Date
}

export interface ChannelResponse {
  text: string
  html?: string
  blocks?: unknown[]
  templateName?: string
  templateParams?: Record<string, string>
  metadata?: Record<string, unknown>
}

export interface ChannelConfig {
  enabled: boolean
  webhookUrl?: string
  config: Record<string, unknown>
}
