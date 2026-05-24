import OpenAI from 'openai'
import { isAssistantLlmAvailable } from '@/lib/assistant/claudeClient'

const DEFAULT_MODEL = process.env.OPENAI_PREDICTION_MODEL ?? process.env.OPENAI_ASSISTANT_MODEL ?? 'gpt-4o'

let client: OpenAI | null = null

function getClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  if (!client) client = new OpenAI({ apiKey })
  return client
}

export function isPredictionLlmAvailable(): boolean {
  return isAssistantLlmAvailable()
}

export async function completeStructuredJson<T>(
  systemPrompt: string,
  userContent: string,
  maxTokens = 4096,
): Promise<T | null> {
  const openai = getClient()
  if (!openai) return null

  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    max_tokens: maxTokens,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  })

  const raw = response.choices[0]?.message?.content?.trim()
  if (!raw) return null

  try {
    return JSON.parse(raw) as T
  } catch {
    console.warn('[ml/llmClient] Failed to parse JSON response')
    return null
  }
}
