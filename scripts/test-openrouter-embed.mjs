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
const model = process.argv[2] || 'nvidia/nemotron-3-embed-1b:free'
const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ model, input: 'test embedding dimensions' }),
})
const json = await res.json()
console.log(
  JSON.stringify(
    {
      status: res.status,
      model,
      dims: json.data?.[0]?.embedding?.length ?? null,
      error: json.error ?? null,
    },
    null,
    2,
  ),
)
