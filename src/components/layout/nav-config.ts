import {
  LayoutDashboard,
  Bot,
  BookOpen,
  Cpu,
  BarChart3,
  TrendingUp,
  GitBranch,
  Package,
  Users2,
  DollarSign,
  UserSquare2,
  Settings,
  CreditCard,
  Bell,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  /** Optional badge label (count or text) */
  badge?: string | number
  /** Grayed out — not yet implemented */
  placeholder?: boolean
}

export interface NavSection {
  label: string
  items: NavItem[]
}

export const navSections: NavSection[] = [
  {
    label: 'OVERVIEW',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'INTELLIGENCE',
    items: [
      { label: 'AI Assistant',   href: '/assistant', icon: Bot },
      { label: 'Knowledge Base', href: '/knowledge', icon: BookOpen },
      { label: 'Agents',         href: '/agents',    icon: Cpu },
    ],
  },
  {
    label: 'ANALYTICS',
    items: [
      { label: 'Analytics',   href: '/analytics',   icon: BarChart3 },
      { label: 'Predictions', href: '/predictions', icon: TrendingUp },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { label: 'Workflows', href: '/workflows', icon: GitBranch },
      { label: 'Inventory', href: '/inventory', icon: Package, placeholder: true },
    ],
  },
  {
    label: 'BUSINESS',
    items: [
      { label: 'CRM',     href: '/crm',     icon: Users2,      placeholder: true },
      { label: 'Finance', href: '/finance', icon: DollarSign,  placeholder: true },
      { label: 'HR',      href: '/hr',      icon: UserSquare2, placeholder: true },
    ],
  },
  {
    label: 'PLATFORM',
    items: [
      { label: 'Alerts',   href: '/alerts',           icon: Bell },
      { label: 'Settings', href: '/settings',          icon: Settings },
      { label: 'Billing',  href: '/settings/billing',  icon: CreditCard },
    ],
  },
]

/** All nav items flat — used by CommandPalette and isActive helpers */
export const allNavItems: NavItem[] = navSections.flatMap((s) => s.items)

/** True if a nav item should appear highlighted for the current pathname */
export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(href + '/')
}

/** Page title derived from the most-specific matching nav item */
export function getTitleFromPathname(pathname: string): string {
  let best: NavItem | undefined
  for (const item of allNavItems) {
    if (isNavItemActive(item.href, pathname)) {
      if (!best || item.href.length > best.href.length) best = item
    }
  }
  return best?.label ?? 'SAIOS'
}
