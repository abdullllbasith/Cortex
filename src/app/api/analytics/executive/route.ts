import { NextResponse } from 'next/server'

/* ─────────────────────────────────────────────────────────────────────────────
   Mock executive analytics endpoint.
   Replace with real DB queries in Module 02.
   ───────────────────────────────────────────────────────────────────────────── */

const revenueChart = [
  { date: 'Mon',   revenue: 32400, isToday: false },
  { date: 'Tue',   revenue: 38100, isToday: false },
  { date: 'Wed',   revenue: 35700, isToday: false },
  { date: 'Thu',   revenue: 41800, isToday: false },
  { date: 'Fri',   revenue: 44200, isToday: false },
  { date: 'Sat',   revenue: 42000, isToday: false },
  { date: 'Today', revenue: 48250, isToday: true  },
]

const mockData = {
  kpis: {
    revenue: {
      value:     48250,
      change:    14.6,
      label:     "Today's Revenue",
      prefix:    '$',
      sparkline: [32400, 38100, 35700, 41800, 44200, 42000, 48250],
    },
    activeOrders: {
      value:     127,
      change:    5.8,
      label:     'Active Orders',
      sparkline: [98, 112, 104, 119, 127, 115, 127],
    },
    lowStock: {
      value:     8,
      change:    -12.5,
      label:     'Low Stock Items',
      sparkline: [3, 5, 7, 4, 9, 11, 8],
    },
    activeWorkflows: {
      value:     23,
      change:    4.5,
      label:     'Active Workflows',
      sparkline: [18, 20, 19, 22, 21, 24, 23],
    },
    aiCalls: {
      used:  1847,
      limit: 5000,
      label: 'AI Calls Today',
      sparkline: [240, 380, 510, 290, 440, 620, 367],
    },
  },
  insight: {
    summary:
      'Revenue is up 14.6% today, driven by a 23% surge in enterprise orders from Acme Corp and TechFlow Ltd. ' +
      'Three customers — Acme Corp, DataSync Inc, and Nexus Partners — are showing elevated churn risk and should be prioritised for proactive outreach.',
    generatedAt: new Date().toISOString(),
  },
  revenueChart,
  agentActivity: [
    { id: '1', agent: 'Churn Detector',    action: 'Flagged Acme Corp as high churn risk (score: 82%)', time: '2m ago',  type: 'alert'     },
    { id: '2', agent: 'Invoice Processor', action: 'Processed 14 invoices — $128,400 total',             time: '8m ago',  type: 'workflow'  },
    { id: '3', agent: 'Stock Monitor',     action: 'Triggered reorder for SKU-4821 (Widget Pro)',        time: '15m ago', type: 'inventory' },
    { id: '4', agent: 'Sales Forecaster',  action: 'Q4 forecast updated to $2.1M (+8% vs last month)',   time: '1h ago',  type: 'analytics' },
    { id: '5', agent: 'Supplier Risk',     action: 'Pacific Supplies delivery delay detected (3 days)',   time: '2h ago',  type: 'alert'     },
    { id: '6', agent: 'Email Campaign',    action: 'Sent 840 renewal reminders — 12% open rate so far',  time: '3h ago',  type: 'workflow'  },
  ],
  alerts: [
    { id: '1', title: 'High churn risk: Acme Corp',            severity: 'danger',  time: '2m ago'  },
    { id: '2', title: '8 products below reorder threshold',    severity: 'warning', time: '15m ago' },
    { id: '3', title: 'Invoice workflow requires approval',    severity: 'info',    time: '1h ago'  },
  ],
  recentWorkflows: [
    { id: '1', name: 'Invoice Processing', status: 'success', duration: '2m 14s', time: '8m ago'  },
    { id: '2', name: 'Churn Analysis',     status: 'success', duration: '45s',    time: '2h ago'  },
    { id: '3', name: 'Stock Reorder',      status: 'running', duration: '—',      time: '15m ago' },
    { id: '4', name: 'Email Campaign',     status: 'failed',  duration: '—',      time: '3h ago'  },
    { id: '5', name: 'Supplier Sync',      status: 'success', duration: '1m 32s', time: '4h ago'  },
  ],
  predictions: [
    { id: '1', event: 'Stock-out: Widget Pro (SKU-4821)',      confidence: 94, daysOut: 2, severity: 'danger'  },
    { id: '2', event: 'Revenue dip — weekend slump expected',  confidence: 78, daysOut: 3, severity: 'warning' },
    { id: '3', event: 'Acme Corp renewal — 42% churn risk',   confidence: 82, daysOut: 7, severity: 'warning' },
  ],
  transactions: [
    { id: 'TXN-4821', customer: 'Acme Corp',          amount: 12400, status: 'paid',     time: '5m ago',   items: 8  },
    { id: 'TXN-4820', customer: 'TechFlow Ltd',       amount:  8750, status: 'pending',  time: '23m ago',  items: 5  },
    { id: 'TXN-4819', customer: 'DataSync Inc',       amount:  3200, status: 'paid',     time: '1h ago',   items: 2  },
    { id: 'TXN-4818', customer: 'CloudBase Systems',  amount: 24100, status: 'paid',     time: '2h ago',   items: 14 },
    { id: 'TXN-4817', customer: 'Nexus Partners',     amount:  6800, status: 'overdue',  time: '4h ago',   items: 4  },
    { id: 'TXN-4816', customer: 'Vertex Solutions',   amount: 15300, status: 'paid',     time: '5h ago',   items: 9  },
    { id: 'TXN-4815', customer: 'Blueprint Labs',     amount:  4200, status: 'paid',     time: '6h ago',   items: 3  },
    { id: 'TXN-4814', customer: 'Summit Analytics',   amount:  9800, status: 'refunded', time: '7h ago',   items: 6  },
    { id: 'TXN-4813', customer: 'Horizon Corp',       amount: 18700, status: 'paid',     time: '8h ago',   items: 11 },
    { id: 'TXN-4812', customer: 'Pinnacle Tech',      amount:  5600, status: 'pending',  time: '10h ago',  items: 3  },
  ],
}

export async function GET() {
  // Simulate slight network latency in development
  if (process.env.NODE_ENV === 'development') {
    await new Promise((r) => setTimeout(r, 300))
  }
  return NextResponse.json(mockData)
}
