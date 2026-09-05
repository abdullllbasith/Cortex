export interface TenantSettings {
  logoUrl?: string | null
  industry?: string
  companySize?: string
  foundedYear?: number
  website?: string
  description?: string
  timezone?: string
  currency?: string
  dateFormat?: string
  numberFormat?: string
  language?: string
  fiscalYearStartMonth?: number
  primaryColor?: string
  secondaryColor?: string
  rolePermissionOverrides?: Partial<Record<string, string[]>>
  inventoryCostingMethod?: 'FIFO' | 'WEIGHTED_AVERAGE' | 'LIFO'
  finance?: {
    bankDetails?: string
    invoiceTerms?: string
    defaultPaymentTermsDays?: number
  }
  admin?: TenantAdminSettings
}

export interface TenantAdminSettings {
  status?: 'active' | 'trial' | 'suspended' | 'churned'
  suspendReason?: string
  suspendedAt?: string
  planOverrideNote?: string
  quotaOverrides?: {
    aiCalls?: number
    workflows?: number
    storageGb?: number
    apiCalls?: number
    teamMembers?: number
  }
  adminNotes?: Array<{ at: string; by: string; note: string }>
  exportRequests?: Array<{
    id: string
    requestedAt: string
    requestedBy: string
    status: 'queued' | 'processing' | 'completed' | 'failed'
    downloadUrl?: string
  }>
}

export interface UserProfileSettings {
  notifyEmail?: boolean
  theme?: 'light' | 'dark' | 'system'
}

export interface TenantGeneralDTO {
  id: string
  name: string
  slug: string
  plan: string
  workspaceUrl: string
  settings: TenantSettings
}

export interface UserProfileDTO {
  id: string
  email: string
  fullName: string
  jobTitle: string | null
  phone: string | null
  avatarUrl: string | null
  timezone: string | null
  role: string
  mfaEnabled: boolean
  profileSettings: UserProfileSettings
}

export interface UserSessionDTO {
  id: string
  device: string
  location: string
  lastActive: string
  isCurrent: boolean
  ipAddress: string | null
}

export const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (31/12/2026)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2026)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2026-12-31)' },
] as const

export const NUMBER_FORMATS = [
  { value: '1,234.56', label: '1,234.56 (US)' },
  { value: '1.234,56', label: '1.234,56 (EU)' },
  { value: '1 234,56', label: '1 234,56 (FR)' },
] as const

export const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'ar', label: 'Arabic' },
] as const

export function parseTenantSettings(raw: unknown): TenantSettings {
  if (!raw || typeof raw !== 'object') return {}
  return raw as TenantSettings
}

export function parseUserProfileSettings(raw: unknown): UserProfileSettings {
  if (!raw || typeof raw !== 'object') return {}
  return raw as UserProfileSettings
}

export function parseUserAgent(ua: string | null | undefined): string {
  if (!ua) return 'Unknown device'
  if (ua.includes('Mobile')) return 'Mobile browser'
  if (ua.includes('Windows')) return 'Windows'
  if (ua.includes('Mac')) return 'macOS'
  if (ua.includes('Linux')) return 'Linux'
  return ua.slice(0, 48)
}
