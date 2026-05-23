'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormProvider } from 'react-hook-form'
import { Zap } from 'lucide-react'
import { useAppForm } from '@/lib/forms/formConfig'
import { registerSchema, type RegisterFormValues } from '@/lib/auth/schemas'
import { FormInput } from '@/components/forms'
import { FormStepper, type FormStep } from '@/components/forms/FormStepper'
import { signUpWithPassword } from '@/lib/supabase/auth'
import { PasswordStrengthMeter } from './PasswordStrengthMeter'
import { SlugField, PlanSelector } from './RegisterFields'

export function RegisterForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const form = useAppForm<RegisterFormValues>({
    schema: registerSchema,
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      companyName: '',
      slug: '',
      plan: 'professional',
    },
  })

  const password = form.watch('password')

  const onComplete = form.handleSubmit(async (values) => {
    setError(null)
    try {
      await signUpWithPassword(values.email, values.password, {
        full_name: `${values.firstName} ${values.lastName}`,
        first_name: values.firstName,
        last_name: values.lastName,
        tenant_name: values.companyName,
        tenant_slug: values.slug,
        tenant_id: values.slug,
        plan: values.plan,
        onboarding_complete: false,
      })
      router.push('/setup')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
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
            <FormInput name="password" label="Password" type="password" required autoComplete="new-password" />
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
      <div className="mb-2 flex items-center gap-2.5 lg:hidden">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <span className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
          SAIOS
        </span>
      </div>

      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Create your account
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Get started with SAIOS in minutes
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
          {error}
        </div>
      )}

      <FormStepper<RegisterFormValues>
        steps={steps}
        storageKey="saios:register-stepper"
        onComplete={onComplete}
      />

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
          Sign in
        </Link>
      </p>
    </FormProvider>
  )
}
