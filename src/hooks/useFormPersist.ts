'use client'

import { useEffect, useRef } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { toast } from '@/components/ui/Toast'

export interface UseFormPersistOptions {
  /** Unique key for localStorage */
  key: string
  enabled?: boolean
  debounceMs?: number
}

export function useFormPersist({
  key,
  enabled = true,
  debounceMs = 500,
}: UseFormPersistOptions) {
  const { reset, getValues } = useFormContext()
  const values = useWatch()
  const restoredRef = useRef(false)
  const storageKey = `saios:form-draft:${key}`

  /* Restore on mount */
  useEffect(() => {
    if (!enabled || restoredRef.current) return
    restoredRef.current = true

    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as { values: Record<string, unknown>; savedAt: string }
      if (parsed?.values) {
        reset({ ...getValues(), ...parsed.values }, { keepDefaultValues: true })
        toast.info('Draft restored', {
          description: `Saved ${new Date(parsed.savedAt).toLocaleString()}`,
        })
      }
    } catch {
      /* ignore corrupt drafts */
    }
  }, [enabled, storageKey, reset, getValues])

  /* Save on change */
  useEffect(() => {
    if (!enabled || values === undefined) return

    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ values, savedAt: new Date().toISOString() }),
        )
      } catch { /* quota */ }
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [values, enabled, storageKey, debounceMs])

  const clearDraft = () => localStorage.removeItem(storageKey)

  return { clearDraft, storageKey }
}
