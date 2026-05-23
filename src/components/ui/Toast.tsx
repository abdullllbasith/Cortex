'use client'

import {
  Toaster as HotToaster,
  toast as hotToast,
  type Toast as HotToastType,
} from 'react-hot-toast'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── Custom toast renderer ─────────────────────────────────────────────── */

interface CustomToastProps {
  t: HotToastType
  variant: 'success' | 'error' | 'warning' | 'info'
  title: string
  description?: string
}

const variantConfig = {
  success: {
    icon: CheckCircle2,
    iconColor: 'text-green-500',
    accent: 'border-l-green-500',
  },
  error: {
    icon: XCircle,
    iconColor: 'text-red-500',
    accent: 'border-l-red-500',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
    accent: 'border-l-amber-500',
  },
  info: {
    icon: Info,
    iconColor: 'text-blue-500',
    accent: 'border-l-blue-500',
  },
}

function CustomToast({ t, variant, title, description }: CustomToastProps) {
  const { icon: Icon, iconColor, accent } = variantConfig[variant]

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex w-full max-w-sm items-start gap-3 rounded-lg border bg-white px-4 py-3 shadow-lg',
        'dark:bg-slate-900 dark:border-slate-700',
        'border-slate-200 border-l-4',
        accent,
        t.visible ? 'animate-slideInRight' : 'animate-fadeOut',
      )}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', iconColor)} aria-hidden="true" />

      <div className="flex-1 overflow-hidden">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{title}</p>
        {description && (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate-2">
            {description}
          </p>
        )}
      </div>

      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => hotToast.dismiss(t.id)}
        className={cn(
          'shrink-0 rounded p-0.5 transition-colors',
          'text-slate-400 hover:text-slate-700',
          'dark:text-slate-500 dark:hover:text-slate-200',
        )}
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}

/* ── toast() API ────────────────────────────────────────────────────────── */

interface ToastOptions {
  description?: string
  duration?: number
  id?: string
}

export const toast = {
  success(title: string, opts?: ToastOptions) {
    return hotToast.custom(
      (t) => <CustomToast t={t} variant="success" title={title} description={opts?.description} />,
      { duration: opts?.duration ?? 4000, id: opts?.id },
    )
  },
  error(title: string, opts?: ToastOptions) {
    return hotToast.custom(
      (t) => <CustomToast t={t} variant="error" title={title} description={opts?.description} />,
      { duration: opts?.duration ?? 5000, id: opts?.id },
    )
  },
  warning(title: string, opts?: ToastOptions) {
    return hotToast.custom(
      (t) => <CustomToast t={t} variant="warning" title={title} description={opts?.description} />,
      { duration: opts?.duration ?? 4000, id: opts?.id },
    )
  },
  info(title: string, opts?: ToastOptions) {
    return hotToast.custom(
      (t) => <CustomToast t={t} variant="info" title={title} description={opts?.description} />,
      { duration: opts?.duration ?? 4000, id: opts?.id },
    )
  },
  loading(title: string, opts?: ToastOptions) {
    return hotToast.loading(title, { id: opts?.id })
  },
  dismiss: hotToast.dismiss,
  promise: hotToast.promise,
}

/* ── <Toaster> ──────────────────────────────────────────────────────────── */

export function Toaster() {
  return (
    <HotToaster
      position="top-right"
      gutter={8}
      containerStyle={{ top: 16, right: 16 }}
      toastOptions={{
        duration: 4000,
        // Default style is overridden per toast via custom renderer above
        style: { padding: 0, background: 'transparent', boxShadow: 'none' },
      }}
    />
  )
}
