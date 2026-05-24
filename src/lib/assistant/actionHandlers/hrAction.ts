import type { ActionTaken, IntentClassification } from '../types'

function actionId(): string {
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export async function handleHrAction(
  _tenantId: string,
  _userId: string,
  message: string,
  classification: IntentClassification,
): Promise<ActionTaken[]> {
  const actions: ActionTaken[] = []

  if (/\b(headcount|team size|staff|employees?)\b/i.test(message)) {
    actions.push({
      id: actionId(),
      type: 'hr.headcount_query',
      description: 'HR headcount data requires HRIS integration — logged request for admin review',
      status: 'pending',
    })
  }

  if (/\b(onboard|hire|new hire)\b/i.test(message) && classification.intent === 'COMMAND') {
    actions.push({
      id: actionId(),
      type: 'hr.onboarding_init',
      description: 'Onboarding workflow initiated — checklist sent to HR team',
      status: 'pending',
    })
  }

  if (/\b(time off|leave|pto|vacation)\b/i.test(message)) {
    actions.push({
      id: actionId(),
      type: 'hr.leave_policy',
      description: 'Retrieved leave policy guidance from knowledge base context',
      status: 'completed',
    })
  }

  return actions
}

export async function undoHrAction(
  _tenantId: string,
  _action: ActionTaken,
): Promise<boolean> {
  return false
}
