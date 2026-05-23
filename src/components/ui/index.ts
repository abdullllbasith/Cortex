// ─────────────────────────────────────────────────────────────────────────────
// SAIOS UI Component Library — Barrel Export
// Module 00 · Step 1 · Design System Foundation
// ─────────────────────────────────────────────────────────────────────────────

// ── Primitives ───────────────────────────────────────────────────────────────
export { Button }                    from './Button'
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button'

export { Input }                     from './Input'
export type { InputProps }           from './Input'

export { Textarea }                  from './Textarea'
export type { TextareaProps }        from './Textarea'

export {
  SelectField,
  SelectRoot, SelectTrigger, SelectContent,
  SelectItem, SelectLabel, SelectSeparator,
  SelectGroup, SelectValue,
}                                    from './Select'
export type {
  SelectFieldProps, SelectOption, SelectGroup as SelectGroupType, SelectData,
}                                    from './Select'

export { Checkbox }                  from './Checkbox'
export type { CheckboxProps }        from './Checkbox'

export { Toggle }                    from './Toggle'
export type { ToggleProps, ToggleSize } from './Toggle'

export { Badge }                     from './Badge'
export type { BadgeProps, BadgeVariant, BadgeSize } from './Badge'

export { Avatar }                    from './Avatar'
export type { AvatarProps, AvatarSize, AvatarStatus } from './Avatar'

export { Tooltip, TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent } from './Tooltip'
export type { TooltipProps, TooltipSide, TooltipAlign } from './Tooltip'

export { Spinner }                   from './Spinner'
export type { SpinnerProps, SpinnerSize, SpinnerVariant } from './Spinner'

// ── Feedback ─────────────────────────────────────────────────────────────────
export { toast, Toaster }            from './Toast'

export {
  Modal,
  ModalRoot, ModalTrigger, ModalClose,
  ModalOverlay, ModalContent,
  ModalHeader, ModalBody, ModalFooter,
  ModalTitle, ModalDescription,
}                                    from './Modal'
export type { ModalProps, ModalSize } from './Modal'

export { ConfirmDialog }             from './ConfirmDialog'
export type { ConfirmDialogProps, ConfirmDialogVariant } from './ConfirmDialog'

export { EmptyState }                from './EmptyState'
export type { EmptyStateProps, EmptyStateAction } from './EmptyState'

export {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonCard,
  SkeletonTableRow,
  SkeletonTable,
}                                    from './SkeletonLoader'
export type {
  SkeletonProps, SkeletonTextProps, SkeletonAvatarProps,
  SkeletonCardProps, SkeletonTableRowProps, SkeletonTableProps,
}                                    from './SkeletonLoader'

export { ErrorBoundary, WithErrorBoundary } from './ErrorBoundary'

// ── Layout ────────────────────────────────────────────────────────────────────
export {
  Card, CardHeader, CardTitle, CardDescription, CardBody, CardFooter,
}                                    from './Card'
export type { CardProps, CardPadding } from './Card'

export { Divider }                   from './Divider'
export type { DividerProps }         from './Divider'

export { PageHeader }                from './PageHeader'
export type { PageHeaderProps, Breadcrumb } from './PageHeader'
