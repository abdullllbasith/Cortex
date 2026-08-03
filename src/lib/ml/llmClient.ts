import { createChatCompletion, isChatLlmAvailable } from '@/lib/ai/llmProvider'

export function isPredictionLlmAvailable(): boolean {
  return isChatLlmAvailable()
}

export async function completeStructuredJson<T>(
  systemPrompt: string,
  userContent: string,
  maxTokens = 4096,
): Promise<T | null> {
  if (!isPredictionLlmAvailable()) return null

  try {
    const response = await createChatCompletion({
      purpose: 'prediction',
      maxTokens,
      temperature: 0.2,
      responseFormat: { type: 'json_object' },
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
  } catch (err) {
    console.warn('[ml/llmClient] Prediction LLM call failed', err)
    return null
  }
}
