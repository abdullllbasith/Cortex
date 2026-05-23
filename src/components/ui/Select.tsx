'use client'

import { forwardRef, useId } from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── Data types ─────────────────────────────────────────────────────────── */

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectGroup {
  groupLabel: string
  options: SelectOption[]
}

export type SelectData = SelectOption[] | SelectGroup[]

function isGrouped(data: SelectData): data is SelectGroup[] {
  return data.length > 0 && 'groupLabel' in data[0]
}

/* ── Sub-components (composable) ─────────────────────────────────────────── */

export const SelectRoot = SelectPrimitive.Root
export const SelectValue = SelectPrimitive.Value
export const SelectGroup = SelectPrimitive.Group

export const SelectTrigger = forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & {
    error?: boolean
    size?: 'sm' | 'md' | 'lg'
  }
>(({ className, children, error, size = 'md', ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex w-full items-center justify-between gap-2 rounded-md border bg-white px-3 text-sm',
      'text-slate-900 transition-colors outline-none',
      'placeholder:text-slate-400',
      'focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'dark:bg-slate-900 dark:text-slate-100',
      error
        ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
        : 'border-slate-200 dark:border-slate-700',
      size === 'sm' ? 'h-7 text-xs' : size === 'lg' ? 'h-11' : 'h-9',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = 'SelectTrigger'

export const SelectContent = forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      sideOffset={4}
      className={cn(
        'relative z-50 min-w-[8rem] overflow-hidden rounded-lg border',
        'bg-white text-slate-900 shadow-lg',
        'dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700',
        'border-slate-200',
        'data-[state=open]:animate-scaleIn',
        'data-[state=closed]:animate-scaleOut',
        position === 'popper' && 'w-[var(--radix-select-trigger-width)]',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ScrollUpButton className="flex h-7 cursor-default items-center justify-center border-b border-slate-100 dark:border-slate-800">
        <ChevronUp className="h-4 w-4 text-slate-400" aria-hidden="true" />
      </SelectPrimitive.ScrollUpButton>

      <SelectPrimitive.Viewport className="p-1">
        {children}
      </SelectPrimitive.Viewport>

      <SelectPrimitive.ScrollDownButton className="flex h-7 cursor-default items-center justify-center border-t border-slate-100 dark:border-slate-800">
        <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
      </SelectPrimitive.ScrollDownButton>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = 'SelectContent'

export const SelectItem = forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-default select-none items-center rounded-md',
      'py-1.5 pl-8 pr-3 text-sm outline-none',
      'transition-colors',
      'focus:bg-indigo-50 focus:text-indigo-900',
      'dark:focus:bg-indigo-950 dark:focus:text-indigo-100',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = 'SelectItem'

export const SelectLabel = forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn(
      'px-2 py-1.5 text-xs font-semibold uppercase tracking-wide',
      'text-slate-500 dark:text-slate-400',
      className,
    )}
    {...props}
  />
))
SelectLabel.displayName = 'SelectLabel'

export const SelectSeparator = forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-slate-100 dark:bg-slate-800', className)}
    {...props}
  />
))
SelectSeparator.displayName = 'SelectSeparator'

/* ── High-level Select component ─────────────────────────────────────────── */

export interface SelectFieldProps {
  data: SelectData
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  label?: string
  helperText?: string
  error?: string
  disabled?: boolean
  required?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
  triggerClassName?: string
}

export function SelectField({
  data,
  value,
  defaultValue,
  onValueChange,
  placeholder = 'Select…',
  label,
  helperText,
  error,
  disabled,
  required,
  size = 'md',
  className,
  triggerClassName,
}: SelectFieldProps) {
  const generatedId = useId()
  const helperId = `${generatedId}-helper`
  const errorId  = `${generatedId}-error`
  const hasError  = Boolean(error)
  const grouped   = isGrouped(data)

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label
          id={`${generatedId}-label`}
          className={cn(
            'text-sm font-medium leading-none',
            disabled
              ? 'text-slate-400 dark:text-slate-600'
              : 'text-slate-700 dark:text-slate-300',
          )}
        >
          {label}
          {required && <span aria-hidden="true" className="ml-1 text-red-500">*</span>}
        </label>
      )}

      <SelectRoot
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <SelectTrigger
          size={size}
          error={hasError}
          aria-labelledby={label ? `${generatedId}-label` : undefined}
          aria-describedby={hasError ? errorId : helperText ? helperId : undefined}
          className={triggerClassName}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>

        <SelectContent>
          {grouped
            ? (data as SelectGroup[]).map((group, gi) => (
                <SelectPrimitive.Group key={gi}>
                  <SelectLabel>{group.groupLabel}</SelectLabel>
                  {group.options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
                      {opt.label}
                    </SelectItem>
                  ))}
                  {gi < data.length - 1 && <SelectSeparator />}
                </SelectPrimitive.Group>
              ))
            : (data as SelectOption[]).map((opt) => (
                <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </SelectItem>
              ))}
        </SelectContent>
      </SelectRoot>

      {hasError ? (
        <p id={errorId} role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : helperText ? (
        <p id={helperId} className="text-xs text-slate-500 dark:text-slate-400">
          {helperText}
        </p>
      ) : null}
    </div>
  )
}
