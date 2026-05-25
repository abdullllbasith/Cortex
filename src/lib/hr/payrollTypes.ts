export interface PayrollLineItem {
  component: string
  amount: number
}

export interface SalaryComponent {
  name: string
  type: 'EARNING' | 'DEDUCTION' | 'BENEFIT'
  calculationType: 'FIXED' | 'PERCENTAGE_OF_BASIC'
  value: number
  isTaxable?: boolean
}
