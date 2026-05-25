'use client'

import { useState, useCallback, useEffect, type ReactNode } from 'react'
import { useFormContext, type FieldPath, type FieldValues } from 'react-hook-form'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'

/* ─────────────────────────────────────────────────────────────────────────────
   Types
   ───────────────────────────────────────────────────────────────────────────── */

export interface FormStep<T extends FieldValues = FieldValues> {
  id: string
  title: string
  description?: string
  /** Field names validated when leaving this step */
  fields: FieldPath<T>[]
  content: ReactNode
}

export interface FormStepperProps<T extends FieldValues = FieldValues> {
  steps: FormStep<T>[]
  /** sessionStorage key for step progress */
  storageKey?: string
  onComplete?: () => void
  /** Called after a step validates successfully and before advancing (not on final step) */
  onStepAdvance?: (stepIndex: number, values: T) => void | Promise<void>
  className?: string
}

/* ─────────────────────────────────────────────────────────────────────────────
   FormStepper
   ───────────────────────────────────────────────────────────────────────────── */

export function FormStepper<T extends FieldValues>({
  steps,
  storageKey = 'saios:form-stepper',
  onComplete,
  onStepAdvance,
  className,
}: FormStepperProps<T>) {
  const { trigger, getValues } = useFormContext<T>()
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())

  /* Restore step from sessionStorage */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey)
      if (!raw) return
      const { step, completed } = JSON.parse(raw) as {
        step: number
        completed: number[]
      }
      if (typeof step === 'number' && step >= 0 && step < steps.length) {
        setCurrentStep(step)
      }
      if (Array.isArray(completed)) {
        setCompletedSteps(new Set(completed))
      }
    } catch { /* ignore */ }
  }, [storageKey, steps.length])

  /* Persist step progress */
  useEffect(() => {
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          step: currentStep,
          completed: [...completedSteps],
          values: getValues(),
        }),
      )
    } catch { /* ignore */ }
  }, [currentStep, completedSteps, storageKey, getValues])

  const isFirst = currentStep === 0
  const isLast  = currentStep === steps.length - 1
  const progress = Math.round(((currentStep + 1) / steps.length) * 100)

  const goNext = useCallback(async () => {
    const step = steps[currentStep]
    const valid = await trigger(step.fields, { shouldFocus: true })
    if (!valid) return

    setCompletedSteps((prev) => new Set([...prev, currentStep]))

    if (isLast) {
      onComplete?.()
    } else {
      await onStepAdvance?.(currentStep, getValues())
      setCurrentStep((s) => s + 1)
    }
  }, [currentStep, isLast, onComplete, onStepAdvance, steps, trigger, getValues])

  const goPrev = () => setCurrentStep((s) => Math.max(0, s - 1))

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {/* Progress bar */}
      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
          <span>Step {currentStep + 1} of {steps.length}</span>
          <span>{progress}% complete</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step indicators */}
      <ol className="flex items-center">
        {steps.map((step, i) => {
          const isActive    = i === currentStep
          const isCompleted = completedSteps.has(i) || i < currentStep

          return (
            <li key={step.id} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1.5 flex-1">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors',
                    isCompleted
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : isActive
                        ? 'border-indigo-600 bg-white text-indigo-600 dark:bg-slate-900'
                        : 'border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-900',
                  )}
                >
                  {isCompleted && !isActive ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={cn(
                    'hidden sm:block text-[10px] font-medium text-center max-w-[80px] truncate',
                    isActive
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-400',
                  )}
                >
                  {step.title}
                </span>
              </div>

              {i < steps.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 flex-1 mx-1',
                    isCompleted ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700',
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          )
        })}
      </ol>

      {/* Step content */}
      <div className="animate-fadeIn">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {steps[currentStep].title}
          </h2>
          {steps[currentStep].description && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {steps[currentStep].description}
            </p>
          )}
        </div>
        {steps[currentStep].content}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={goPrev}
          disabled={isFirst}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={goNext}
        >
          {isLast ? 'Complete' : 'Next'}
        </Button>
      </div>
    </div>
  )
}
