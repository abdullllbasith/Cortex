import { readFileSync, existsSync } from 'fs'

if (!existsSync('.env')) {
  console.log('No .env')
  process.exit(0)
}

const env = readFileSync('.env', 'utf8')
for (const key of [
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_VERIFY_TOKEN',
  'WHATSAPP_APP_SECRET',
]) {
  const match = env.match(new RegExp(`^${key}=(.*)$`, 'm'))
  let val = match?.[1]?.trim() ?? ''
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1)
  }
  console.log(`${key}: ${val ? `set (${val.length} chars)` : 'MISSING'}`)
}
