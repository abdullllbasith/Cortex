export const DEFAULT_WORKFLOW_TEST_INPUT = {
  customer: {
    id: 'test-customer',
    name: 'Abdul Basith',
    email: 'abdulbasithcool2003@gmail.com',
    company: 'Softora',
    purchaseCount: 0,
    churnProbability: 0.85,
  },
}

export function workflowUsesCustomerVariables(nodes: Array<{ data?: { config?: Record<string, unknown> } }>): boolean {
  return nodes.some((n) => JSON.stringify(n.data?.config ?? {}).includes('{{customer.'))
}
