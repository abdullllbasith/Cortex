import {
  createChatCompletion,
  getDefaultMaxTokens,
  isChatLlmAvailable,
  streamChatCompletion,
} from '@/lib/ai/llmProvider'
import type { ConversationTurn } from './types'

/** @deprecated Use isAssistantLlmAvailable — kept for existing imports */
export function isClaudeAvailable(): boolean {
  return isAssistantLlmAvailable()
}

export function isAssistantLlmAvailable(): boolean {
  return isChatLlmAvailable()
}

export interface ClaudeMessageParams {
  systemPrompt: string
  messages: ConversationTurn[]
  maxTokens?: number
  temperature?: number
}

function toChatMessages(params: ClaudeMessageParams) {
  return [
    { role: 'system' as const, content: params.systemPrompt },
    ...params.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
  ]
}

export async function completeWithClaude(params: ClaudeMessageParams): Promise<string> {
  if (!isAssistantLlmAvailable()) {
    throw new Error('LLM API key not configured (set OPENROUTER_API_KEY or OPENAI_API_KEY)')
  }

  const response = await createChatCompletion({
    messages: toChatMessages(params),
    maxTokens: params.maxTokens ?? getDefaultMaxTokens(),
    temperature: params.temperature ?? 0.3,
    purpose: 'chat',
  })

  return response.choices[0]?.message?.content?.trim() ?? ''
}

export async function* streamWithClaude(
  params: ClaudeMessageParams,
): AsyncGenerator<string, void, unknown> {
  if (!isAssistantLlmAvailable()) {
    throw new Error('LLM API key not configured (set OPENROUTER_API_KEY or OPENAI_API_KEY)')
  }

  yield* streamChatCompletion({
    messages: toChatMessages(params),
    maxTokens: params.maxTokens ?? getDefaultMaxTokens(),
    temperature: params.temperature ?? 0.3,
    purpose: 'chat',
  })
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
