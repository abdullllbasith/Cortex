'use client'

import { NODE_CATEGORIES } from '@/lib/workflows/types'

const PALETTE_ITEMS = [
  { type: 'trigger.manual', label: 'Manual Trigger', category: 'Triggers' },
  { type: 'trigger.schedule', label: 'Schedule', category: 'Triggers' },
  { type: 'trigger.event', label: 'Event', category: 'Triggers' },
  { type: 'trigger.webhook', label: 'Webhook', category: 'Triggers' },
  { type: 'action.send_notification', label: 'Send Notification', category: 'Actions' },
  { type: 'action.update_record', label: 'Update Record', category: 'Actions' },
  { type: 'action.generate_document', label: 'Generate Document', category: 'Actions' },
  { type: 'action.ai_decision', label: 'AI Decision', category: 'Actions' },
  { type: 'control.condition', label: 'Condition', category: 'Control' },
  { type: 'control.delay', label: 'Delay', category: 'Control' },
  { type: 'control.loop', label: 'Loop', category: 'Control' },
  { type: 'integration.http_request', label: 'HTTP Request', category: 'Integrations' },
]

interface NodePaletteProps {
  onAdd: (type: string) => void
}

export function NodePalette({ onAdd }: NodePaletteProps) {
  const categories = ['Triggers', 'Actions', 'Control', 'Integrations'] as const

  return (
    <aside className="w-56 shrink-0 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-3 overflow-y-auto">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Nodes</h3>
      {categories.map((cat) => (
        <div key={cat} className="mb-4">
          <p className="text-[10px] font-medium text-slate-400 mb-1.5">{cat}</p>
          <div className="space-y-1">
            {PALETTE_ITEMS.filter((i) => i.category === cat).map((item) => (
              <button
                key={item.type}
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', item.type)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onClick={() => onAdd(item.type)}
                className="w-full text-left text-xs px-2 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <p className="text-[10px] text-slate-400 mt-2">Drag or click to add</p>
    </aside>
  )
}

export { NODE_CATEGORIES }
