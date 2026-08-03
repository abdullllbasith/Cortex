'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormProvider } from 'react-hook-form'
import { useAppForm } from '@/lib/forms/formConfig'
import { registerSchema, type RegisterFormValues } from '@/lib/auth/schemas'
import { FormInput } from '@/components/forms'
import { FormStepper, type FormStep } from '@/components/forms/FormStepper'
import { PasswordStrengthMeter } from './PasswordStrengthMeter'
import { PasswordInput } from './PasswordInput'
import { SlugField, PlanSelector } from './RegisterFields'
import { Controller } from 'react-hook-form'
import { FormField } from '@/components/forms/FormField'
import { SaiosBrandLockup } from '@/components/branding/SaiosBrandLockup'
import { DemoCredentialsPanel } from './DemoCredentialsPanel'
import { toast } from '@/components/ui/Toast'
import { markPostSignupSetupPending } from '@/components/onboarding/PostSignupSetupModal'

export function RegisterForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [completing, setCompleting] = useState(false)

  const form = useAppForm<RegisterFormValues>({
    schema: registerSchema,
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      companyName: '',
      slug: '',
      plan: 'starter',
    },
  })

  const password = form.watch('password')

  const checkEmailAvailable = async (email: string): Promise<boolean> => {
    const res = await fetch(`/api/auth/check-email?email=${encodeURIComponent(email.trim())}`)
    const json = (await res.json()) as { available?: boolean; message?: string }
    if (!res.ok || json.available === false) {
      form.setError('email', {
        type: 'manual',
        message:
          json.message ??
          'An account already exists for this email. Sign in instead.',
      })
      return false
    }
    form.clearErrors('email')
    return true
  }

  const onStepAdvance = async (stepIndex: number, values: RegisterFormValues) => {
    if (stepIndex !== 0) return true
    return checkEmailAvailable(values.email)
  }

  const onComplete = form.handleSubmit(async (values) => {
    setError(null)
    setCompleting(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(values),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? 'Registration failed')
      }

      const { applyAuthSession } = await import('@/lib/auth/sessionClient')
      applyAuthSession({
        user: json.data.user,
        tenant: json.data.tenant,
        permissions: json.data.permissions ?? ['*'],
        accessToken: json.data.accessToken,
      })

      const { hydrateSessionFromServer } = await import('@/lib/auth/sessionClient')
      await hydrateSessionFromServer()

      try {
        sessionStorage.removeItem('saios:register-stepper')
      } catch { /* ignore */ }

      markPostSignupSetupPending()

      toast.success('Account created successfully', {
        description: 'Welcome to Cortex — taking you to your dashboard…',
        duration: 3500,
      })

      await new Promise((r) => setTimeout(r, 1200))
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setCompleting(false)
    }
  })

  const steps: FormStep<RegisterFormValues>[] = [
    {
      id: 'personal',
      title: 'Personal',
      description: 'Tell us about yourself',
      fields: ['firstName', 'lastName', 'email', 'password'],
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormInput name="firstName" label="First name" required autoComplete="given-name" />
            <FormInput name="lastName" label="Last name" required autoComplete="family-name" />
          </div>
          <FormInput name="email" label="Work email" type="email" required autoComplete="email" />
          <div>
            <Controller
              name="password"
              control={form.control}
              render={({ field, fieldState }) => (
                <FormField name="password" label="Password" required error={fieldState.error?.message}>
                  <PasswordInput
                    {...field}
                    autoComplete="new-password"
                    error={fieldState.error?.message}
                    showErrorMessage={false}
                  />
                </FormField>
              )}
            />
            <PasswordStrengthMeter password={password ?? ''} />
          </div>
        </div>
      ),
    },
    {
      id: 'company',
      title: 'Company',
      description: 'Set up your workspace',
      fields: ['companyName', 'slug'],
      content: (
        <div className="space-y-4">
          <FormInput name="companyName" label="Company name" required />
          <SlugField name="slug" companyNameField="companyName" />
        </div>
      ),
    },
    {
      id: 'plan',
      title: 'Plan',
      description: 'Choose the right plan for your team',
      fields: ['plan'],
      content: <PlanSelector name="plan" />,
    },
  ]

  return (
    <FormProvider {...form}>
      <div className="mb-2 lg:hidden">
        <SaiosBrandLockup surface="light" href="/" />
      </div>

      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Create your account
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Get started with Cortex in minutes
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
          {error}
        </div>
      )}

      <DemoCredentialsPanel variant="register" className="mb-6" />

      <FormStepper<RegisterFormValues>
        steps={steps}
        storageKey="saios:register-stepper"
        onComplete={onComplete}
        onStepAdvance={onStepAdvance}
        completing={completing}
      />

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Already have an account?{' '}
        <Link href="/login" style={{ textDecoration: 'none' }} className="font-medium text-[#5BA8A0] hover:text-[#3D8E87] dark:text-[#7ECAC3]">
          Sign in
        </Link>
      </p>
    </FormProvider>
  )
}
