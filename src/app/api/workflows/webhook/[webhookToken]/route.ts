import { NextResponse } from 'next/server'
import { apiSuccess } from '@/lib/knowledge/response'
import { workflowRepository } from '@/lib/workflows/workflowRepository'
import { workflowEngine } from '@/lib/workflows/core/WorkflowEngine'
import '@/lib/workflows/nodes'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ webhookToken: string }> },
) {
  try {
    const { webhookToken } = await params
    const workflow = await workflowRepository.findByWebhookToken(webhookToken)
    if (!workflow) {
      return NextResponse.json({ success: false, error: { message: 'Invalid webhook', code: 'NOT_FOUND' } }, { status: 404 })
    }

    const inputData = await request.json().catch(() => ({})) as Record<string, unknown>
    const result = await workflowEngine.execute(workflow.id, inputData, {
      triggeredBy: 'webhook',
    })

    return NextResponse.json(apiSuccess(result))
  } catch (err) {
    console.error('[webhook]', err)
    return NextResponse.json({ success: false, error: { message: 'Webhook execution failed', code: 'INTERNAL_ERROR' } }, { status: 500 })
  }
}
