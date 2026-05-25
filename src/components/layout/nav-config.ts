import {
  LayoutDashboard,
  Bot,
  BookOpen,
  Cpu,
  BarChart3,
  TrendingUp,
  GitBranch,
  Package,
  RefreshCw,
  Users2,
  DollarSign,
  UserSquare2,
  ShoppingCart,
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
      { label: 'AI Executive Assistant', href: '/assistant', icon: Bot },
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
      { label: 'Inventory', href: '/inventory', icon: Package },
      { label: 'Reorder', href: '/inventory/reorder', icon: RefreshCw, badgeVariant: 'danger' },
    ],
  },
  {
    label: 'BUSINESS',
    items: [
      { label: 'CRM', href: '/crm', icon: Users2 },
      { label: 'Sales', href: '/sales/quotes', icon: ShoppingCart },
      { label: 'Finance', href: '/finance', icon: DollarSign },
      { label: 'HR',      href: '/hr',      icon: UserSquare2 },
    ],
  },
  {
    label: 'PLATFORM',
    items: [
      { label: 'Notifications', href: '/notifications', icon: Bell },
      { label: 'Alerts', href: '/alerts', icon: Bell },
      { label: 'Settings', href: '/settings',          icon: Settings },
      { label: 'Billing',  href: '/settings/billing',  icon: CreditCard },
    ],
  },
]

/** All nav items flat — used by CommandPalette and isActive helpers */
export const allNavItems: NavItem[] = navSections.flatMap((s) => s.items)

function pathnameMatchesHref(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(href + '/')
}

/** True if a nav item should appear highlighted for the current pathname (most-specific match wins). */
export function isNavItemActive(
  href: string,
  pathname: string,
  navItems: NavItem[] = allNavItems,
): boolean {
  if (!pathnameMatchesHref(pathname, href)) return false

  // Suppress parent items when a more specific nav sibling also matches (e.g. Inventory vs Reorder).
  for (const item of navItems) {
    if (item.href === href) continue
    if (item.href.startsWith(href + '/') && pathnameMatchesHref(pathname, item.href)) {
      return false
    }
  }
  return true
}

/** Page title derived from the most-specific matching nav item */
export function getTitleFromPathname(pathname: string): string {
  let best: NavItem | undefined
  for (const item of allNavItems) {
    if (pathnameMatchesHref(pathname, item.href)) {
      if (!best || item.href.length > best.href.length) best = item
    }
  }
  return best?.label ?? 'SAIOS'
}
