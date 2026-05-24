import OpenAI from 'openai'
import type { ConversationTurn } from './types'

const DEFAULT_MODEL = process.env.OPENAI_ASSISTANT_MODEL ?? 'gpt-4o'

let client: OpenAI | null = null

function getClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  if (!client) client = new OpenAI({ apiKey })
  return client
}

/** @deprecated Use isAssistantLlmAvailable — kept for existing imports */
export function isClaudeAvailable(): boolean {
  return isAssistantLlmAvailable()
}

export function isAssistantLlmAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY)
}

export interface ClaudeMessageParams {
  systemPrompt: string
  messages: ConversationTurn[]
  maxTokens?: number
  temperature?: number
}

function toChatMessages(params: ClaudeMessageParams): OpenAI.Chat.ChatCompletionMessageParam[] {
  return [
    { role: 'system', content: params.systemPrompt },
    ...params.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
  ]
}

export async function completeWithClaude(params: ClaudeMessageParams): Promise<string> {
  const openai = getClient()
  if (!openai) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    max_tokens: params.maxTokens ?? 4096,
    temperature: params.temperature ?? 0.3,
    messages: toChatMessages(params),
  })

  return response.choices[0]?.message?.content?.trim() ?? ''
}

export async function* streamWithClaude(
  params: ClaudeMessageParams,
): AsyncGenerator<string, void, unknown> {
  const openai = getClient()
  if (!openai) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  const stream = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    max_tokens: params.maxTokens ?? 4096,
    temperature: params.temperature ?? 0.3,
    messages: toChatMessages(params),
    stream: true,
  })

  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content
    if (token) yield token
  }
}

export async function summarizeWithClaude(text: string): Promise<string> {
  if (!isAssistantLlmAvailable()) {
    return text.slice(0, 500)
  }

  return completeWithClaude({
    systemPrompt:
      'Summarize the following conversation history concisely for context retention. Preserve key facts, decisions, and entity names. Max 300 words.',
    messages: [{ role: 'user', content: text }],
    maxTokens: 512,
    temperature: 0.2,
  })
}

/** Preferred OpenAI aliases */
export const completeWithOpenAI = completeWithClaude
export const streamWithOpenAI = streamWithClaude
export const summarizeWithOpenAI = summarizeWithClaude
