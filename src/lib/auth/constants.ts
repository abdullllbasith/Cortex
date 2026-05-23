export const INDUSTRIES = [
  'Retail & E-commerce',
  'Manufacturing',
  'Healthcare',
  'Financial Services',
  'Technology & SaaS',
  'Professional Services',
  'Real Estate',
  'Hospitality & Travel',
  'Education',
  'Logistics & Supply Chain',
  'Construction',
  'Agriculture',
  'Media & Entertainment',
  'Non-profit',
  'Government',
  'Energy & Utilities',
  'Automotive',
  'Food & Beverage',
  'Legal',
  'Other',
] as const

export const COMPANY_SIZES = [
  { value: '1-10', label: '1–10 employees' },
  { value: '11-50', label: '11–50 employees' },
  { value: '51-200', label: '51–200 employees' },
  { value: '200+', label: '200+ employees' },
] as const

export const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Central European (CET)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST)' },
] as const

export const CURRENCIES = [
  { value: 'USD', label: 'USD — US Dollar', flag: '🇺🇸' },
  { value: 'EUR', label: 'EUR — Euro', flag: '🇪🇺' },
  { value: 'GBP', label: 'GBP — British Pound', flag: '🇬🇧' },
  { value: 'CAD', label: 'CAD — Canadian Dollar', flag: '🇨🇦' },
  { value: 'AUD', label: 'AUD — Australian Dollar', flag: '🇦🇺' },
  { value: 'INR', label: 'INR — Indian Rupee', flag: '🇮🇳' },
  { value: 'JPY', label: 'JPY — Japanese Yen', flag: '🇯🇵' },
  { value: 'SGD', label: 'SGD — Singapore Dollar', flag: '🇸🇬' },
  { value: 'AED', label: 'AED — UAE Dirham', flag: '🇦🇪' },
] as const

export const FISCAL_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

export const WORKFLOW_TEMPLATES = [
  {
    id: 'low-stock-reorder',
    name: 'Low Stock Auto-Reorder',
    description: 'Monitors inventory levels and automatically creates purchase orders when stock falls below threshold.',
    industries: ['Retail & E-commerce', 'Manufacturing', 'Food & Beverage', 'Other'],
  },
  {
    id: 'invoice-chase',
    name: 'Overdue Invoice Follow-up',
    description: 'Sends personalised payment reminders and escalates overdue invoices to your finance team.',
    industries: ['Professional Services', 'Technology & SaaS', 'Financial Services', 'Other'],
  },
  {
    id: 'lead-nurture',
    name: 'Lead Nurture Sequence',
    description: 'Scores inbound leads and triggers AI-drafted follow-up emails based on engagement signals.',
    industries: ['Technology & SaaS', 'Real Estate', 'Professional Services', 'Other'],
  },
] as const
