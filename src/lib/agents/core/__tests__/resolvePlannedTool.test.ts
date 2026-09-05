import { resolvePlannedTool } from '@/lib/agents/core/resolvePlannedTool'

describe('resolvePlannedTool', () => {
  const tools = new Set(['getRevenue', 'getOutstandingAR', 'getBusinessHealthSummary'])

  it('accepts known tools', () => {
    expect(resolvePlannedTool('getRevenue', tools)).toBe('getRevenue')
  })

  it('rejects JSON null / undefined', () => {
    expect(resolvePlannedTool(null, tools)).toBeUndefined()
    expect(resolvePlannedTool(undefined, tools)).toBeUndefined()
  })

  it('rejects string null tokens from LLMs', () => {
    expect(resolvePlannedTool('null', tools)).toBeUndefined()
    expect(resolvePlannedTool('None', tools)).toBeUndefined()
    expect(resolvePlannedTool('undefined', tools)).toBeUndefined()
  })

  it('rejects unknown tool names', () => {
    expect(resolvePlannedTool('inventedTool', tools)).toBeUndefined()
  })
})
