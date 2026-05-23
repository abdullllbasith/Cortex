'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormProvider } from 'react-hook-form'
import { Zap } from 'lucide-react'
import { Button } from '@/components/ui'
import { FormInput, FormCheckbox } from '@/components/forms'
import { useAppForm } from '@/lib/forms/formConfig'
import { loginSchema, type LoginFormValues } from '@/lib/auth/schemas'
import { signInWithPassword } from '@/lib/supabase/auth'
import { OAuthButtons } from './OAuthButtons'

export function LoginForm() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useAppForm<LoginFormValues>({
    schema: loginSchema,
    defaultValues: { email: '', password: '', rememberMe: true },
  })

  const { handleSubmit, formState: { isSubmitting }, setError } = form

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      const result = await signInWithPassword(
        values.email,
        values.password,
        values.rememberMe ?? true,
      )
      router.push(result.isNewUser ? '/setup' : '/dashboard')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed'
      if (message.toLowerCase().includes('email')) {
        setError('email', { message })
      } else if (message.toLowerCase().includes('password')) {
        setError('password', { message: 'Invalid email or password' })
      } else {
        setServerError(message)
      }
    }
  })

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="space-y-7">
        {/* Mobile brand */}
        <div className="flex items-center gap-2.5 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 shadow-sm">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
            SAIOS
          </span>
        </div>

        {/* Desktop wordmark */}
        <div className="hidden lg:block">
          <div className="mb-6 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              SAIOS
            </span>
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Welcome back
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Sign in to your SAIOS workspace
          </p>
        </div>

        {/* Mobile heading */}
        <div className="lg:hidden">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Welcome back
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Sign in to your SAIOS workspace
          </p>
        </div>

        {serverError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400"
          >
            {serverError}
          </div>
        )}

        <div className="space-y-4">
          <FormInput
            name="email"
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            required
          />
          <FormInput
            name="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            required
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <FormCheckbox name="rememberMe" label="Remember me for 30 days" />
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" variant="primary" size="lg" className="w-full" loading={isSubmitting}>
          Sign in
        </Button>

        <OAuthButtons />

        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          Don&apos;t have an account?{' '}
          <Link
            href="/register"
            className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            Start free trial
          </Link>
        </p>
      </form>
    </FormProvider>
  )
}
