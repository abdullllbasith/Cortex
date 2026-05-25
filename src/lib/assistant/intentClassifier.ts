import type { IntentClassification, AssistantIntent } from './types'

const INTENT_PATTERNS: Array<{
  intent: AssistantIntent
  handler?: IntentClassification['handler']
  patterns: RegExp[]
  weight: number
}> = [
  {
    intent: 'COMMAND',
    handler: 'inventory',
    weight: 0.9,
    patterns: [
      /\b(add|remove|update|adjust|set|restock)\b.*\b(inventory|stock|items?|units?)\b/i,
      /\bcheck\s+stock\b/i,
      /\bwhat(?:'s|\s+is)\s+low\b/i,
      /\b(create|draft|new)\b.*\bpurchase\s+order\b/i,
      /\breorder\s+(status|suggestion)/i,
    ],
  },
  {
    intent: 'COMMAND',
    handler: 'crm',
    weight: 0.88,
    patterns: [
      /\blog\s+(a\s+)?call\b/i,
      /\b(schedule|set)\b.*\bfollow[- ]?up\b/i,
      /\bmove\b.*\b(deal|stage)\b/i,
      /\bmy\s+leads?\b/i,
    ],
  },
  {
    intent: 'COMMAND',
    handler: 'sales',
    weight: 0.85,
    patterns: [
      /\b(create|update|add|record)\b.*\b(order|sale|deal|quote|customer)\b/i,
      /\bmark\b.*\b(won|lost|closed)\b/i,
      /\bopen\s+orders?\b/i,
    ],
  },
  {
    intent: 'COMMAND',
    handler: 'finance',
    weight: 0.85,
    patterns: [
      /\b(create|send)\b.*\b(invoice)\b/i,
      /\brecord\b.*\b(payment)\b/i,
    ],
  },
  {
    intent: 'COMMAND',
    handler: 'hr',
    weight: 0.85,
    patterns: [
      /\b(approve)\b.*\b(leave)\b/i,
      /\b(time off|leave|pto|vacation)\b/i,
    ],
  },
  {
    intent: 'REPORT',
    handler: 'finance',
    weight: 0.82,
    patterns: [
      /\b(revenue|profit|overdue\s+invoices?|outstanding\s+ar)\b/i,
      /\b(report|summary|overview)\b.*\b(finance|invoice|payment)\b/i,
    ],
  },
  {
    intent: 'REPORT',
    handler: 'sales',
    weight: 0.8,
    patterns: [
      /\b(today('s)?\s+sales|top\s+customers?|open\s+orders?)\b/i,
      /\b(report|summary)\b.*\b(sales|pipeline)\b/i,
    ],
  },
  {
    intent: 'REPORT',
    weight: 0.8,
    patterns: [
      /\b(report|summary|overview|dashboard|breakdown|analysis)\b/i,
      /\bshow me\b.*\b(numbers|metrics|stats|performance)\b/i,
    ],
  },
  {
    intent: 'FORECAST',
    weight: 0.8,
    patterns: [
      /\b(forecast|predict|projection|trend|outlook|estimate)\b/i,
    ],
  },
  {
    intent: 'AUTOMATION',
    weight: 0.75,
    patterns: [
      /\b(automate|schedule|trigger|workflow)\b/i,
    ],
  },
]

function extractEntities(message: string): Record<string, string | number | boolean> {
  const entities: Record<string, string | number | boolean> = {}

  const addMatch = message.match(
    /\b(?:add|restock|increase|remove|decrease)\s+(\d+)\s+(?:units?\s+of\s+)?(.+?)(?:\s+(?:to|into|from)\s+(?:inventory|stock))?\.?$/i,
  )
  if (addMatch) {
    entities.quantity = parseInt(addMatch[1], 10)
    entities.productName = addMatch[2].trim().replace(/^["']|["']$/g, '')
  }

  const quantityMatch = message.match(/\b(\d+)\s*(items?|units?)?\b/i)
  if (quantityMatch && entities.quantity == null) {
    entities.quantity = parseInt(quantityMatch[1], 10)
  }

  const stockCheckMatch = message.match(
    /\b(?:check\s+)?stock\s+(?:of|for|level\s+of)\s+["']?([^"'\n.?]+)["']?/i,
  )
  if (stockCheckMatch) entities.productName = stockCheckMatch[1].trim()

  const poMatch = message.match(/\b(?:purchase\s+order|po)\s+(?:for\s+)?["']?([^"'\n.?]+)["']?/i)
  if (poMatch) entities.supplierName = poMatch[1].trim()

  const contactMatch = message.match(
    /\b(?:with|for)\s+["']?([A-Za-z][\w\s.'-]{1,60})["']?(?:\s+on\s+|\s*$)/i,
  )
  if (contactMatch) entities.contactName = contactMatch[1].trim()

  const quoteMatch = message.match(/\bquote\s+for\s+["']?([^"'\n.?]+)["']?/i)
  if (quoteMatch) entities.contactName = quoteMatch[1].trim()

  const dealMoveMatch = message.match(/\bmove\s+["']?([^"'\n]+?)["']?\s+to\s+["']?([^"'\n.?]+)["']?/i)
  if (dealMoveMatch) {
    entities.dealTitle = dealMoveMatch[1].trim()
    entities.stageName = dealMoveMatch[2].trim()
  }

  const followUpMatch = message.match(/\bon\s+([\w\s,/-]+?)(?:\s*$|\.)/i)
  if (followUpMatch) entities.followUpDate = followUpMatch[1].trim()

  const invoiceMatch = message.match(/\binvoice\s+#?([A-Z0-9-]+)/i)
  if (invoiceMatch) entities.invoiceNumber = invoiceMatch[1].trim()

  const amountMatch = message.match(/\$\s?([\d,]+(?:\.\d{2})?)/)
  if (amountMatch) entities.amount = parseFloat(amountMatch[1].replace(/,/g, ''))

  const periodMatch = message.match(/\b(today|this week|this month|this quarter|ytd)\b/i)
  if (periodMatch) entities.period = periodMatch[1].toLowerCase()

  return entities
}

export function classifyIntent(message: string): IntentClassification {
  const normalized = message.trim()
  let bestIntent: AssistantIntent = 'QUERY'
  let bestScore = 0.4
  let handler: IntentClassification['handler']

  for (const rule of INTENT_PATTERNS) {
    for (const pattern of rule.patterns) {
      if (pattern.test(normalized)) {
        if (rule.weight > bestScore) {
          bestScore = rule.weight
          bestIntent = rule.intent
          handler = rule.handler
        }
      }
    }
  }

  if (!handler) {
    if (/\b(invoice|payment|overdue|profit|revenue)\b/i.test(normalized)) handler = 'finance'
    else if (/\b(stock|inventory|warehouse|reorder|po|supplier)\b/i.test(normalized)) handler = 'inventory'
    else if (/\b(lead|deal|pipeline|contact|follow)\b/i.test(normalized)) handler = 'crm'
    else if (/\b(order|quote|sale|customer)\b/i.test(normalized)) handler = 'sales'
    else if (/\b(employee|leave|attendance|payroll)\b/i.test(normalized)) handler = 'hr'
  }

  return {
    intent: bestIntent,
    confidence: Math.min(bestScore, 0.99),
    entities: extractEntities(normalized),
    handler,
  }
}
