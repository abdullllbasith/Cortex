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
      /\b(add|remove|update|adjust|set|restock|stock)\b.*\b(inventory|stock|items?|units?|quantity)\b/i,
      /\binventory\b.*\b(to|by|at)\b/i,
      /\bcheck\s+stock\b/i,
      /\bwhat(?:'s|\s+is)\s+low\b/i,
      /\b(create|draft|new)\b.*\bpurchase\s+order\b/i,
    ],
  },
  {
    intent: 'COMMAND',
    handler: 'sales',
    weight: 0.85,
    patterns: [
      /\b(create|update|add|record)\b.*\b(order|sale|deal|quote|customer)\b/i,
      /\bmark\b.*\b(won|lost|closed)\b/i,
    ],
  },
  {
    intent: 'COMMAND',
    handler: 'finance',
    weight: 0.85,
    patterns: [
      /\b(create|send|approve|reject)\b.*\b(invoice|payment|expense|budget)\b/i,
      /\brecord\b.*\b(payment|expense|transaction)\b/i,
    ],
  },
  {
    intent: 'COMMAND',
    handler: 'hr',
    weight: 0.85,
    patterns: [
      /\b(hire|onboard|terminate|promote|assign)\b.*\b(employee|staff|team member|role)\b/i,
      /\b(time off|leave|pto|vacation)\b/i,
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
      /\bwhat will\b.*\b(next|future|upcoming)\b/i,
    ],
  },
  {
    intent: 'AUTOMATION',
    weight: 0.75,
    patterns: [
      /\b(automate|schedule|trigger|workflow|whenever|every time)\b/i,
      /\bset up\b.*\b(alert|notification|rule)\b/i,
    ],
  },
]

function extractEntities(message: string): Record<string, string | number | boolean> {
  const entities: Record<string, string | number | boolean> = {}

  const addMatch = message.match(
    /\b(?:add|restock|increase)\s+(\d+)\s+(?:units?\s+of\s+)?(.+?)(?:\s+(?:to|into|in)\s+(?:inventory|stock))?\.?$/i,
  )
  if (addMatch) {
    entities.quantity = parseInt(addMatch[1], 10)
    entities.productName = addMatch[2].trim().replace(/^["']|["']$/g, '')
  }

  const quantityMatch = message.match(/\b(\d+)\s*(items?|units?|products?|stock)?\b/i)
  if (quantityMatch && entities.quantity == null) {
    entities.quantity = parseInt(quantityMatch[1], 10)
  }

  const stockCheckMatch = message.match(
    /\b(?:check\s+)?stock\s+(?:of|for|level\s+of)\s+["']?([^"'\n.?]+)["']?/i,
  )
  if (stockCheckMatch) {
    entities.productName = stockCheckMatch[1].trim()
  }

  const productMatch = message.match(/\bfor\s+["']?([^"'\n,]+)["']?\s*(product|item)?\b/i)
  if (productMatch && !entities.productName) {
    entities.productName = productMatch[1].trim()
  }

  const poMatch = message.match(/\bpurchase\s+order\s+(?:for\s+)?["']?([^"'\n.?]+)["']?/i)
  if (poMatch) entities.supplierName = poMatch[1].trim()

  const amountMatch = message.match(/\$\s?([\d,]+(?:\.\d{2})?)/)
  if (amountMatch) entities.amount = parseFloat(amountMatch[1].replace(/,/g, ''))

  const periodMatch = message.match(/\b(today|this week|this month|this quarter|ytd|last \d+ days)\b/i)
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
        const score = rule.weight
        if (score > bestScore) {
          bestScore = score
          bestIntent = rule.intent
          handler = rule.handler
        }
      }
    }
  }

  return {
    intent: bestIntent,
    confidence: Math.min(bestScore, 0.99),
    entities: extractEntities(normalized),
    handler,
  }
}
