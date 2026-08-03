'use client'

import { useState, useEffect } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X, Filter } from 'lucide-react'
import { Button, Badge, Input, Toggle } from '@/components/ui'
import { SelectField } from '@/components/ui'
import { cn } from '@/lib/utils'

/* ─────────────────────────────────────────────────────────────────────────────
   Types
   ───────────────────────────────────────────────────────────────────────────── */

export type FilterFieldType =
  | 'text'
  | 'select'
  | 'multi-select'
  | 'date-range'
  | 'number-range'
  | 'boolean'

export interface FilterField {
  key: string
  label: string
  type: FilterFieldType
  options?: Array<{ value: string; label: string }>
  placeholder?: string
  min?: number
  max?: number
}

export type FilterValues = Record<string, unknown>

export interface FilterDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fields: FilterField[]
  values: FilterValues
  onChange: (values: FilterValues) => void
  onApply: (values: FilterValues) => void
  onReset: () => void
  activeCount?: number
}

/* ─────────────────────────────────────────────────────────────────────────────
   Individual field renderers
   ───────────────────────────────────────────────────────────────────────────── */

function TextField({
  field,
  value,
  onChange,
}: {
  field: FilterField
  value: string
  onChange: (v: string) => void
}) {
  return (
    <Input
      label={field.label}
      placeholder={field.placeholder ?? `Filter by ${field.label.toLowerCase()}…`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function SelectFilterField({
  field,
  value,
  onChange,
}: {
  field: FilterField
  value: string
  onChange: (v: string) => void
}) {
  return (
    <SelectField
      data={field.options ?? []}
      value={value}
      onValueChange={onChange}
      label={field.label}
      placeholder={`All ${field.label.toLowerCase()}s`}
    />
  )
}

function MultiSelectField({
  field,
  value,
  onChange,
}: {
  field: FilterField
  value: string[]
  onChange: (v: string[]) => void
}) {
  const options = field.options ?? []
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{field.label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value.includes(opt.value)
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() =>
                onChange(
                  active ? value.filter((v) => v !== opt.value) : [...value, opt.value],
                )
              }
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                active
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
              )}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DateRangeField({
  field,
  value,
  onChange,
}: {
  field: FilterField
  value: { from?: string; to?: string }
  onChange: (v: { from?: string; to?: string }) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{field.label}</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400">From</label>
          <input
            type="date"
            value={value?.from ?? ''}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className={cn(
              'mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm',
              'text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20',
              'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
            )}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400">To</label>
          <input
            type="date"
            value={value?.to ?? ''}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            min={value?.from}
            className={cn(
              'mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm',
              'text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20',
              'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
            )}
          />
        </div>
      </div>
    </div>
  )
}

function NumberRangeField({
  field,
  value,
  onChange,
}: {
  field: FilterField
  value: { min?: number; max?: number }
  onChange: (v: { min?: number; max?: number }) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{field.label}</p>
      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder={`Min${field.min !== undefined ? ` (${field.min})` : ''}`}
          type="number"
          value={value?.min ?? ''}
          onChange={(e) => onChange({ ...value, min: e.target.value ? Number(e.target.value) : undefined })}
        />
        <Input
          placeholder={`Max${field.max !== undefined ? ` (${field.max})` : ''}`}
          type="number"
          value={value?.max ?? ''}
          onChange={(e) => onChange({ ...value, max: e.target.value ? Number(e.target.value) : undefined })}
        />
      </div>
    </div>
  )
}

function BooleanField({
  field,
  value,
  onChange,
}: {
  field: FilterField
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <Toggle
      label={field.label}
      checked={value}
      onCheckedChange={onChange}
    />
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   FilterDrawer
   ───────────────────────────────────────────────────────────────────────────── */

export function FilterDrawer({
  open,
  onOpenChange,
  fields,
  values,
  onChange,
  onApply,
  onReset,
  activeCount = 0,
}: FilterDrawerProps) {
  const [local, setLocal] = useState<FilterValues>(values)

  // Sync from outside on open
  useEffect(() => { if (open) setLocal(values) }, [open, values])

  const updateField = (key: string, value: unknown) =>
    setLocal((prev) => ({ ...prev, [key]: value }))

  const handleApply = () => {
    onChange(local)
    onApply(local)
    onOpenChange(false)
  }

  const handleReset = () => {
    setLocal({})
    onReset()
    onOpenChange(false)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Overlay */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] data-[state=open]:animate-fadeIn data-[state=closed]:animate-fadeOut" />

        {/* Drawer panel */}
        <DialogPrimitive.Content
          aria-label="Filter panel"
          className={cn(
            'fixed right-0 top-0 z-50 flex h-full w-full max-w-[340px] flex-col',
            'bg-white shadow-xl dark:bg-slate-900',
            'border-l border-slate-100 dark:border-slate-800',
            'data-[state=open]:animate-slideInRight',
            'focus:outline-none',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-500" aria-hidden="true" />
              <DialogPrimitive.Title className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Filters
              </DialogPrimitive.Title>
              {activeCount > 0 && <Badge variant="info" size="sm">{activeCount} active</Badge>}
            </div>
            <DialogPrimitive.Close
              aria-label="Close filters"
              className={cn(
                'rounded-md p-1 transition-colors',
                'text-slate-400 hover:bg-slate-100 hover:text-slate-700',
                'dark:hover:bg-slate-800 dark:hover:text-slate-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
              )}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>

          {/* Filter fields */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 scroll-area">
            {fields.map((field) => {
              const val = local[field.key]
              switch (field.type) {
                case 'text':
                  return <TextField key={field.key} field={field} value={(val as string) ?? ''} onChange={(v) => updateField(field.key, v)} />
                case 'select':
                  return <SelectFilterField key={field.key} field={field} value={(val as string) ?? ''} onChange={(v) => updateField(field.key, v)} />
                case 'multi-select':
                  return <MultiSelectField key={field.key} field={field} value={(val as string[]) ?? []} onChange={(v) => updateField(field.key, v)} />
                case 'date-range':
                  return <DateRangeField key={field.key} field={field} value={(val as { from?: string; to?: string }) ?? {}} onChange={(v) => updateField(field.key, v)} />
                case 'number-range':
                  return <NumberRangeField key={field.key} field={field} value={(val as { min?: number; max?: number }) ?? {}} onChange={(v) => updateField(field.key, v)} />
                case 'boolean':
                  return <BooleanField key={field.key} field={field} value={(val as boolean) ?? false} onChange={(v) => updateField(field.key, v)} />
                default:
                  return null
              }
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800 px-5 py-4">
            <Button variant="ghost" size="sm" onClick={handleReset}>
              Reset all
            </Button>
            <Button variant="primary" size="sm" onClick={handleApply}>
              Apply filters
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
