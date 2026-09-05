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
  AlertTriangle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PERMISSIONS, type Permission } from '@/lib/auth/permissions'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  /** Required permission to show this item; omit for always-visible signed-in routes */
  permission?: Permission
  /** Optional badge label (count or text) */
  badge?: string | number
  badgeVariant?: 'default' | 'danger'
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
    items: [{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'OPERATIONS',
    items: [
      {
        label: 'Inventory',
        href: '/inventory',
        icon: Package,
        permission: PERMISSIONS.INVENTORY_VIEW,
      },
      {
        label: 'Reorder',
        href: '/inventory/reorder',
        icon: RefreshCw,
        badgeVariant: 'danger',
        permission: PERMISSIONS.INVENTORY_VIEW,
      },
    ],
  },
  {
    label: 'BUSINESS',
    items: [
      { label: 'CRM', href: '/crm', icon: Users2, permission: PERMISSIONS.CRM_VIEW },
      {
        label: 'Sales',
        href: '/sales/quotes',
        icon: ShoppingCart,
        permission: PERMISSIONS.SALES_VIEW,
      },
      {
        label: 'Finance',
        href: '/finance',
        icon: DollarSign,
        permission: PERMISSIONS.FINANCE_VIEW,
      },
    ],
  },
  {
    label: 'INTELLIGENCE',
    items: [
      {
        label: 'AI Executive Assistant',
        href: '/assistant',
        icon: Bot,
        permission: PERMISSIONS.AGENTS_USE,
      },
      {
        label: 'Knowledge Base',
        href: '/knowledge',
        icon: BookOpen,
        permission: PERMISSIONS.KNOWLEDGE_READ,
      },
      { label: 'Agents', href: '/agents', icon: Cpu, permission: PERMISSIONS.AGENTS_USE },
    ],
  },
  {
    label: 'ANALYTICS & AUTOMATION',
    items: [
      {
        label: 'Analytics',
        href: '/analytics',
        icon: BarChart3,
        permission: PERMISSIONS.ANALYTICS_VIEW,
      },
      {
        label: 'Predictions',
        href: '/predictions',
        icon: TrendingUp,
        permission: PERMISSIONS.PREDICTIONS_VIEW,
      },
      {
        label: 'Workflows',
        href: '/workflows',
        icon: GitBranch,
        permission: PERMISSIONS.WORKFLOWS_VIEW,
      },
    ],
  },
  {
    label: 'PEOPLE',
    items: [{ label: 'HR', href: '/hr', icon: UserSquare2, permission: PERMISSIONS.HR_VIEW }],
  },
  {
    label: 'PLATFORM',
    items: [
      {
        label: 'Notifications',
        href: '/notifications',
        icon: Bell,
        permission: PERMISSIONS.PREDICTIONS_VIEW,
      },
      {
        label: 'Alerts',
        href: '/alerts',
        icon: AlertTriangle,
        permission: PERMISSIONS.PREDICTIONS_VIEW,
      },
      {
        label: 'Billing',
        href: '/settings/billing',
        icon: CreditCard,
        permission: PERMISSIONS.BILLING_MANAGE,
      },
      { label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
]

export function filterNavSections(
  sections: NavSection[],
  hasPermission: (permission: string) => boolean,
): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.permission || hasPermission(item.permission),
      ),
    }))
    .filter((section) => section.items.length > 0)
}

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
  return best?.label ?? 'Cortex'
}
