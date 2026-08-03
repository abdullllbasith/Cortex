import { classifyIntent } from '../intentClassifier'

describe('intentClassifier', () => {
  it('classifies inventory commands', () => {
    const result = classifyIntent('Add 50 items to inventory for Widget Pro')
    expect(result.intent).toBe('COMMAND')
    expect(result.handler).toBe('inventory')
    expect(result.entities.quantity).toBe(50)
  })

  it('classifies report requests', () => {
    const result = classifyIntent('Give me a sales report for this month')
    expect(result.intent).toBe('REPORT')
  })

  it('classifies forecast requests', () => {
    const result = classifyIntent('Forecast demand for next quarter')
    expect(result.intent).toBe('FORECAST')
  })

  it('defaults to QUERY', () => {
    const result = classifyIntent('What is our return policy?')
    expect(result.intent).toBe('QUERY')
  })
})
