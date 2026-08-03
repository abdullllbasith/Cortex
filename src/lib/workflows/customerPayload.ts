/** Shape passed to workflows when a customer is created or referenced in {{customer.*}} variables. */
export interface WorkflowCustomerVariables {
  customer: {
    id: string
    name: string
    email: string
    company: string
    purchaseCount: number
  }
}

export function toWorkflowCustomerPayload(customer: {
  id: string
  profile: unknown
  purchaseHistory: unknown
}): WorkflowCustomerVariables {
  const profile = (customer.profile ?? {}) as Record<string, unknown>
  const history = Array.isArray(customer.purchaseHistory) ? customer.purchaseHistory : []
  return {
    customer: {
      id: customer.id,
      name: String(profile.name ?? ''),
      email: String(profile.email ?? ''),
      company: String(profile.company ?? ''),
      purchaseCount: history.length,
    },
  }
}
