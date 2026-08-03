'use client'

import { forwardRef } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

/* ── Primitive re-exports (for composability) ────────────────────────────── */

export const ModalRoot    = DialogPrimitive.Root
export const ModalTrigger = DialogPrimitive.Trigger
export const ModalClose   = DialogPrimitive.Close

/* ── Overlay ────────────────────────────────────────────────────────────── */

export const ModalOverlay = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]',
      'data-[state=open]:animate-fadeIn',
      'data-[state=closed]:animate-fadeOut',
      className,
    )}
    {...props}
  />
))
ModalOverlay.displayName = 'ModalOverlay'

/* ── Content ────────────────────────────────────────────────────────────── */

const sizeClasses: Record<ModalSize, string> = {
  sm:   'max-w-[400px]',
  md:   'max-w-[560px]',
  lg:   'max-w-[720px]',
  xl:   'max-w-[900px]',
  full: 'max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)]',
}

export const ModalContent = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    size?: ModalSize
    /** Hide the default close button */
    hideClose?: boolean
  }
>(({ className, children, size = 'md', hideClose = false, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <ModalOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2',
        'flex flex-col rounded-xl bg-white shadow-xl',
        'dark:bg-slate-900 dark:border dark:border-slate-800',
        'focus:outline-none',
        'data-[state=open]:animate-scaleIn',
        'data-[state=closed]:animate-scaleOut',
        'max-h-[90vh]',
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {children}

      {!hideClose && (
        <DialogPrimitive.Close
          aria-label="Close dialog"
          className={cn(
            'absolute right-4 top-4 rounded-md p-1 transition-colors',
            'text-slate-400 hover:text-slate-700 hover:bg-slate-100',
            'dark:text-slate-500 dark:hover:text-slate-200 dark:hover:bg-slate-800',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
          )}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
ModalContent.displayName = 'ModalContent'

/* ── Slot components ────────────────────────────────────────────────────── */

export function ModalHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800',
        className,
      )}
      {...props}
    />
  )
}

export function ModalBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex-1 overflow-y-auto px-6 py-4', className)}
      {...props}
    />
  )
}

export function ModalFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2 px-6 pt-4 pb-6',
        'border-t border-slate-100 dark:border-slate-800',
        className,
      )}
      {...props}
    />
  )
}

export const ModalTitle = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'text-lg font-semibold leading-tight text-slate-900 dark:text-slate-100',
      className,
    )}
    {...props}
  />
))
ModalTitle.displayName = 'ModalTitle'

export const ModalDescription = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-slate-500 dark:text-slate-400', className)}
    {...props}
  />
))
ModalDescription.displayName = 'ModalDescription'

/* ── High-level <Modal> convenience wrapper ──────────────────────────────── */

export interface ModalProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  size?: ModalSize
  title?: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  hideClose?: boolean
  trigger?: React.ReactNode
}

export function Modal({
  open,
  onOpenChange,
  size = 'md',
  title,
  description,
  children,
  footer,
  hideClose,
  trigger,
}: ModalProps) {
  return (
    <ModalRoot open={open} onOpenChange={onOpenChange}>
      {trigger && <ModalTrigger asChild>{trigger}</ModalTrigger>}
      <ModalContent size={size} hideClose={hideClose}>
        {(title || description) && (
          <ModalHeader>
            {title && <ModalTitle>{title}</ModalTitle>}
            {description && <ModalDescription>{description}</ModalDescription>}
          </ModalHeader>
        )}
        <ModalBody>{children}</ModalBody>
        {footer && <ModalFooter>{footer}</ModalFooter>}
      </ModalContent>
    </ModalRoot>
  )
}
