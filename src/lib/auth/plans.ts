export type PlanId = 'starter' | 'professional' | 'enterprise'

export interface PlanFeature {
  text: string
  included: boolean
}

export interface Plan {
  id: PlanId
  name: string
  price: string
  period?: string
  description: string
  highlighted?: boolean
  badge?: string
  cta: string
  features: string[]
}

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 'Free',
    period: '14-day trial',
    description: 'Perfect for small teams exploring AI-powered operations.',
    cta: 'Start free trial',
    features: [
      'Up to 5 team members',
      '2 AI agents',
      'Basic analytics dashboard',
      'Email support',
      '1 GB storage',
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    price: '$49',
    period: '/month',
    description: 'Everything you need to run your business on AI.',
    highlighted: true,
    badge: 'Most popular',
    cta: 'Start with Professional',
    features: [
      'Up to 25 team members',
      'Unlimited AI agents',
      'Advanced analytics & predictions',
      'Workflow automation',
      'Priority support',
      '50 GB storage',
      'API access',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    description: 'Dedicated infrastructure, SSO, and white-glove onboarding.',
    cta: 'Contact sales',
    features: [
      'Unlimited team members',
      'Custom AI models',
      'Dedicated success manager',
      'SSO / SAML',
      'SLA guarantee',
      'On-premise option',
      'Custom integrations',
    ],
  },
]
