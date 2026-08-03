import OpenAI from 'openai'

/**
 * Shared OpenAI-compatible LLM client via OpenRouter.
 * Multi-model chain: LLM_CHAT_MODELS / LLM_PREDICTION_MODELS (comma-separated).
 * Default: Nemotron 3 Ultra → GPT-OSS 20B (free).
 */

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
const DEFAULT_MODEL_CHAIN = [
  'nvidia/nemotron-3-ultra-550b-a55b',
  'openai/gpt-oss-20b:free',
] as const

let chatClient: OpenAI | null = null

function parseModelChain(raw: string | undefined, fallback: readonly string[]): string[] {
  const list = (raw ?? '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean)
  return list.length > 0 ? list : [...fallback]
}

function resolveChatApiKey(): string | null {
  return (
    process.env.OPENROUTER_API_KEY?.trim() ||
    process.env.LLM_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    null
  )
}

function resolveChatBaseUrl(): string | undefined {
  const explicit = process.env.LLM_BASE_URL?.trim() || process.env.OPENROUTER_BASE_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  if (process.env.OPENROUTER_API_KEY?.trim() || process.env.LLM_API_KEY?.trim()) {
    return OPENROUTER_BASE_URL
  }
  return undefined
}

/** Chat / agents / briefing client (OpenRouter when configured). */
export function getChatLlmClient(): OpenAI | null {
  const apiKey = resolveChatApiKey()
  if (!apiKey) return null
  if (!chatClient) {
    const baseURL = resolveChatBaseUrl()
    chatClient = new OpenAI({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
      defaultHeaders: baseURL?.includes('openrouter.ai')
        ? {
            'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://cortex.app',
            'X-Title': 'Cortex',
          }
        : undefined,
    })
  }
  return chatClient
}

export function isChatLlmAvailable(): boolean {
  return Boolean(resolveChatApiKey())
}

/** Ordered chat models — first success wins; later entries are fallbacks. */
export function getChatModelChain(): string[] {
  return parseModelChain(
    process.env.LLM_CHAT_MODELS ?? process.env.OPENAI_ASSISTANT_MODEL,
    DEFAULT_MODEL_CHAIN,
  )
}

/** Ordered prediction / structured-JSON models. */
export function getPredictionModelChain(): string[] {
  return parseModelChain(
    process.env.LLM_PREDICTION_MODELS ??
      process.env.OPENAI_PREDICTION_MODEL ??
      process.env.LLM_CHAT_MODELS ??
      process.env.OPENAI_ASSISTANT_MODEL,
    DEFAULT_MODEL_CHAIN,
  )
}

export function getDefaultMaxTokens(): number {
  return Number(process.env.OPENAI_ASSISTANT_MAX_TOKENS ?? process.env.LLM_MAX_TOKENS ?? 2048)
}

export type ChatCompletionParams = {
  messages: OpenAI.Chat.ChatCompletionMessageParam[]
  maxTokens?: number
  temperature?: number
  responseFormat?: OpenAI.Chat.ChatCompletionCreateParams['response_format']
  /** Use prediction model chain instead of chat chain. */
  purpose?: 'chat' | 'prediction'
}

/**
 * Try each model in the chain until one succeeds.
 * Ready for multi-model: add more models to LLM_CHAT_MODELS / LLM_PREDICTION_MODELS.
 */
export async function createChatCompletion(
  params: ChatCompletionParams,
): Promise<OpenAI.Chat.ChatCompletion> {
  const client = getChatLlmClient()
  if (!client) {
    throw new Error('LLM API key not configured (set OPENROUTER_API_KEY or OPENAI_API_KEY)')
  }

  const models =
    params.purpose === 'prediction' ? getPredictionModelChain() : getChatModelChain()
  let lastError: unknown

  for (const model of models) {
    try {
      return await client.chat.completions.create({
        model,
        messages: params.messages,
        max_tokens: params.maxTokens ?? getDefaultMaxTokens(),
        temperature: params.temperature ?? 0.3,
        ...(params.responseFormat ? { response_format: params.responseFormat } : {}),
      })
    } catch (err) {
      lastError = err
      console.warn(`[llmProvider] model failed, trying next: ${model}`, err)
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('All LLM models in the chain failed')
}

export async function* streamChatCompletion(
  params: Omit<ChatCompletionParams, 'responseFormat'>,
): AsyncGenerator<string, void, unknown> {
  const client = getChatLlmClient()
  if (!client) {
    throw new Error('LLM API key not configured (set OPENROUTER_API_KEY or OPENAI_API_KEY)')
  }

  const models = getChatModelChain()
  let lastError: unknown

  for (const model of models) {
    try {
      const stream = await client.chat.completions.create({
        model,
        messages: params.messages,
        max_tokens: params.maxTokens ?? getDefaultMaxTokens(),
        temperature: params.temperature ?? 0.3,
        stream: true,
      })

      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content
        if (token) yield token
      }
      return
    } catch (err) {
      lastError = err
      console.warn(`[llmProvider] stream model failed, trying next: ${model}`, err)
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('All LLM models in the stream chain failed')
}
