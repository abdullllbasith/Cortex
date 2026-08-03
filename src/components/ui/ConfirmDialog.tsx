'use client'

import { useState } from 'react'
import { AlertTriangle, Trash2, AlertCircle } from 'lucide-react'
import {
  ModalRoot,
  ModalTrigger,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalTitle,
  ModalDescription,
} from './Modal'
import { Button } from './Button'
import { cn } from '@/lib/utils'

export type ConfirmDialogVariant = 'danger' | 'warning' | 'info'

export interface ConfirmDialogProps {
  /** Controlled open state */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Optional trigger element */
  trigger?: React.ReactNode
  title: string
  description?: string
  /** Label for the confirm button (default: "Confirm") */
  confirmLabel?: string
  /** Label for the cancel button (default: "Cancel") */
  cancelLabel?: string
  variant?: ConfirmDialogVariant
  /** Called when the user confirms */
  onConfirm: () => void | Promise<void>
  /** Called when the user cancels */
  onCancel?: () => void
}

const variantConfig: Record<
  ConfirmDialogVariant,
  { icon: React.ElementType; iconBg: string; iconColor: string }
> = {
  danger: {
    icon: Trash2,
    iconBg: 'bg-red-50 dark:bg-red-950/40',
    iconColor: 'text-red-600 dark:text-red-400',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-50 dark:bg-amber-950/40',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  info: {
    icon: AlertCircle,
    iconBg: 'bg-blue-50 dark:bg-blue-950/40',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
}

export function ConfirmDialog({
  open: controlledOpen,
  onOpenChange,
  trigger,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false)
  const { icon: Icon, iconBg, iconColor } = variantConfig[variant]

  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen

  const handleOpenChange = (next: boolean) => {
    if (!isControlled) setInternalOpen(next)
    onOpenChange?.(next)
  }

  const handleConfirm = async () => {
    try {
      setLoading(true)
      await onConfirm()
      handleOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    onCancel?.()
    handleOpenChange(false)
  }

  return (
    <ModalRoot open={open} onOpenChange={handleOpenChange}>
      {trigger && <ModalTrigger asChild>{trigger}</ModalTrigger>}

      <ModalContent size="sm" hideClose>
        <ModalHeader>
          <div className="flex items-start gap-4">
            <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', iconBg)}>
              <Icon className={cn('h-5 w-5', iconColor)} aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-1">
              <ModalTitle>{title}</ModalTitle>
              {description && <ModalDescription>{description}</ModalDescription>}
            </div>
          </div>
        </ModalHeader>

        <ModalBody className="py-2" />

        <ModalFooter>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCancel}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="sm"
            loading={loading}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </ModalRoot>
  )
}
