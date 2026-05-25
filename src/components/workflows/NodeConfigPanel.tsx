'use client'

import { Input, Textarea, SelectField } from '@/components/ui'
import type { WorkflowNodeData } from './nodes/WorkflowFlowNodes'

interface NodeConfigPanelProps {
  nodeId: string | null
  nodeType: string | null
  data: WorkflowNodeData | null
  onChange: (nodeId: string, data: WorkflowNodeData) => void
  onClose: () => void
}

export function NodeConfigPanel({ nodeId, nodeType, data, onChange, onClose }: NodeConfigPanelProps) {
  if (!nodeId || !nodeType || !data) {
    return (
      <aside className="w-72 shrink-0 border-l border-slate-200 dark:border-slate-700 p-4 text-sm text-slate-400">
        Select a node to configure
      </aside>
    )
  }

  const config = data.config ?? {}

  function setConfig(key: string, value: unknown) {
    if (!nodeId) return
    onChange(nodeId, {
      ...data,
      config: { ...config, [key]: value },
    })
  }

  return (
    <aside className="w-72 shrink-0 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold">Configure Node</h3>
        <button type="button" onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600">Close</button>
      </div>
      <p className="text-xs text-slate-500 mb-3 font-mono">{nodeType}</p>

      <Input
        label="Label"
        value={data.label ?? ''}
        onChange={(e) => onChange(nodeId, { ...data, label: e.target.value })}
        className="mb-3"
      />

      {nodeType === 'action.send_notification' && (
        <>
          <SelectField
            label="Channel"
            data={[
              { value: 'email', label: 'Email' },
              { value: 'slack', label: 'Slack' },
              { value: 'whatsapp', label: 'WhatsApp' },
              { value: 'sms', label: 'SMS' },
            ]}
            value={String(config.channel ?? 'email')}
            onValueChange={(v) => setConfig('channel', v)}
          />
          <Input label="Recipient" value={String(config.recipient ?? '')} onChange={(e) => setConfig('recipient', e.target.value)} className="mt-2" />
          <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
            Variables like {'{{customer.email}}'} are filled from workflow data — not typed literally. Use Run Now → test JSON, or Activate + create a customer for live runs.
          </p>
          <Textarea label="Message" value={String(config.message ?? '')} onChange={(e) => setConfig('message', e.target.value)} className="mt-2" rows={3} />
        </>
      )}

      {nodeType === 'action.update_record' && (
        <>
          <SelectField
            label="Entity"
            data={[
              { value: 'customer', label: 'Customer' },
              { value: 'product', label: 'Product' },
              { value: 'supplier', label: 'Supplier' },
            ]}
            value={String(config.entity ?? 'customer')}
            onValueChange={(v) => setConfig('entity', v)}
          />
          <Input label="Entity ID" value={String(config.entityId ?? '')} onChange={(e) => setConfig('entityId', e.target.value)} className="mt-2" />
        </>
      )}

      {nodeType === 'action.ai_decision' && (
        <Textarea label="Prompt" value={String(config.prompt ?? '')} onChange={(e) => setConfig('prompt', e.target.value)} rows={4} />
      )}

      {nodeType === 'control.condition' && (
        <Textarea
          label="Conditions JSON"
          value={JSON.stringify(config.conditions ?? [{ field: 'value', operator: 'eq', value: true }], null, 2)}
          onChange={(e) => {
            try { setConfig('conditions', JSON.parse(e.target.value)) } catch { /* ignore */ }
          }}
          rows={6}
        />
      )}

      {nodeType === 'control.delay' && (
        <>
          <Input label="Duration" type="number" value={String(config.duration ?? 1)} onChange={(e) => setConfig('duration', Number(e.target.value))} />
          <SelectField
            label="Unit"
            data={[
              { value: 'minutes', label: 'Minutes' },
              { value: 'hours', label: 'Hours' },
              { value: 'days', label: 'Days' },
            ]}
            value={String(config.unit ?? 'minutes')}
            onValueChange={(v) => setConfig('unit', v)}
            className="mt-2"
          />
        </>
      )}

      {nodeType === 'trigger.schedule' && (
        <Input label="Cron Expression" value={String(config.cronExpression ?? '0 9 * * *')} onChange={(e) => setConfig('cronExpression', e.target.value)} />
      )}

      {nodeType === 'trigger.event' && (
        <SelectField
          label="Event Type"
          data={[
            { value: 'new_order', label: 'New Order' },
            { value: 'low_stock', label: 'Low Stock' },
            { value: 'new_customer', label: 'New Customer' },
            { value: 'payment_received', label: 'Payment Received' },
            { value: 'stock_level_changed', label: 'Stock Level Changed' },
            { value: 'stock_below_reorder', label: 'Stock Below Reorder (STOCK_BELOW_REORDER)' },
            { value: 'order_delivered', label: 'Order Delivered (ORDER_DELIVERED)' },
            { value: 'goods_received', label: 'Goods Received (GOODS_RECEIVED)' },
            { value: 'new_contact_created', label: 'New Contact Created' },
            { value: 'deal_won', label: 'Deal Won' },
            { value: 'deal_lost', label: 'Deal Lost' },
            { value: 'follow_up_due', label: 'Follow-up Due' },
            { value: 'po_status_changed', label: 'PO Status Changed' },
          ]}
          value={String(config.eventType ?? 'new_order')}
          onValueChange={(v) => setConfig('eventType', v)}
        />
      )}

      {nodeType === 'integration.http_request' && (
        <>
          <Input label="URL" value={String(config.url ?? '')} onChange={(e) => setConfig('url', e.target.value)} />
          <SelectField
            label="Method"
            data={[
              { value: 'GET', label: 'GET' },
              { value: 'POST', label: 'POST' },
              { value: 'PUT', label: 'PUT' },
            ]}
            value={String(config.method ?? 'GET')}
            onValueChange={(v) => setConfig('method', v)}
            className="mt-2"
          />
        </>
      )}
    </aside>
  )
}
