const NO_TOOL_TOKENS = new Set(['null', 'none', 'undefined', 'n/a', 'na', '-', ''])

/** Normalize LLM tool picks — models often return the string "null" instead of JSON null. */
export function resolvePlannedTool(
  raw: unknown,
  knownTools: ReadonlySet<string>,
): string | undefined {
  if (raw == null) return undefined
  const name = String(raw).trim()
  if (NO_TOOL_TOKENS.has(name.toLowerCase())) return undefined
  if (!knownTools.has(name)) return undefined
  return name
}
