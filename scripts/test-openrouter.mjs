/**
 * Quick OpenRouter / Nemotron smoke test.
 * Usage: node scripts/test-openrouter.mjs
 */
import { readFileSync, existsSync } from 'fs'

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const i = trimmed.indexOf('=')
    if (i === -1) continue
    const key = trimmed.slice(0, i).trim()
    let val = trimmed.slice(i + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

const key = process.env.OPENROUTER_API_KEY
const models = (
  process.env.LLM_CHAT_MODELS ||
  'nvidia/nemotron-3-ultra-550b-a55b,openai/gpt-oss-20b:free'
)
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean)

if (!key) {
  console.error('Missing OPENROUTER_API_KEY')
  process.exit(1)
}

const only = process.argv[2]
const toTest = only ? [only] : models

for (const model of toTest) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://saios.softora.ai',
      'X-Title': 'SAIOS',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'Reply with only the word OK.' },
        { role: 'user', content: 'ping' },
      ],
      max_tokens: 64,
    }),
  })

  const json = await res.json()
  console.log('---')
  console.log('status', res.status)
  console.log('model', json.model ?? model)
  console.log('content', json.choices?.[0]?.message?.content?.slice(0, 300) ?? null)
  if (json.error) {
    console.error('error', json.error)
    process.exit(1)
  }
}
console.log('OK')
