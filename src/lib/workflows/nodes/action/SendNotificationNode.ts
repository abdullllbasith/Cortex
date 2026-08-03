import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { notificationService } from '@/lib/notifications/notificationService'
import { WorkflowContext } from '../../core/WorkflowContext'
import type { NodeHandler, WorkflowEngineContext } from '../../types'
import { nodeError, validateConfig } from '../utils'
import { sendMail, isEmailConfigured } from '@/lib/email/mailTransport'

const schema = z.object({
  channel: z.enum(['whatsapp', 'email', 'slack', 'sms']),
  recipient: z.string().min(1),
  template: z.string().optional(),
  message: z.string().optional(),
  variables: z.record(z.string(), z.unknown()).optional(),
})

async function sendSlack(text: string, channel?: string) {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) throw nodeError('action.send_notification', 'SLACK_BOT_TOKEN not configured')
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: channel ?? '#general', text }),
  })
  const data = await res.json() as { ok: boolean; error?: string }
  if (!data.ok) throw nodeError('action.send_notification', data.error ?? 'Slack send failed')
}

async function sendEmail(to: string, subject: string, body: string) {
  if (!isEmailConfigured()) {
    throw nodeError('action.send_notification', 'Email transport not configured (SMTP or SendGrid)')
  }
  await sendMail({
    to,
    subject,
    text: body,
    fromName: 'Cortex Workflows',
  })
}

async function sendWhatsApp(to: string, body: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneNumberId) throw nodeError('action.send_notification', 'WhatsApp not configured')
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to.replace(/^wa:/, ''),
      type: 'text',
      text: { body: body.slice(0, 4096) },
    }),
  })
  if (!res.ok) throw nodeError('action.send_notification', `WhatsApp send failed: ${res.status}`)
}

export const sendNotificationHandler: NodeHandler = async ({ inputData, config }, engineCtx) => {
  const cfg = validateConfig(schema, config, 'action.send_notification')
  const ctx = new WorkflowContext(engineCtx as WorkflowEngineContext)

  const recipient = String(ctx.interpolate(cfg.recipient)).trim()
  if (!recipient) {
    throw nodeError(
      'action.send_notification',
      'No recipients defined. Set Recipient on this node (e.g. your@email.com), or pass workflow data so variables like {{customer.email}} resolve.',
    )
  }
  const message = String(ctx.interpolate(cfg.message ?? cfg.template ?? 'Notification from Cortex workflow'))

  switch (cfg.channel) {
    case 'slack':
      await sendSlack(message, recipient.startsWith('#') ? recipient : undefined)
      break
    case 'email':
      await sendEmail(recipient, 'Cortex Workflow Notification', message)
      break
    case 'whatsapp':
      await sendWhatsApp(recipient, message)
      break
    case 'sms':
      ctx.appendLog('SMS channel logged (Twilio integration pending)')
      break
  }

  ctx.appendLog(`Notification sent via ${cfg.channel} to ${recipient}`)

  await notificationService.send({
    tenantId: engineCtx.tenantId,
    userId: engineCtx.triggeredBy ?? undefined,
    roleTarget: engineCtx.triggeredBy ? undefined : ['OWNER', 'MANAGER'],
    title: 'Workflow notification',
    body: message,
    type: 'SYSTEM',
    severity: 'INFO',
    metadata: { channel: cfg.channel, recipient, workflowExecutionId: engineCtx.executionId },
  }).catch(() => {})

  await prisma.agentLog.create({
    data: {
      tenantId: engineCtx.tenantId,
      agentId: 'workflow',
      agentType: 'OPERATIONS',
      action: 'send_notification',
      input: { channel: cfg.channel, recipient } as never,
      result: { success: true } as never,
      status: 'SUCCESS',
      taskId: engineCtx.executionId,
    },
  }).catch(() => {})

  return {
    outputData: {
      ...inputData,
      notification: { channel: cfg.channel, recipient, message, sentAt: new Date().toISOString() },
    },
  }
}
