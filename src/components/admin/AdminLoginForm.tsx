'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { FormProvider, Controller } from 'react-hook-form'
import { Button } from '@/components/ui'
import { FormInput, FormField } from '@/components/forms'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { useAppForm } from '@/lib/forms/formConfig'
import { loginSchema, type LoginFormValues } from '@/lib/auth/schemas'
import { useAdminSessionStore } from '@/store/adminSessionStore'

function AdminLoginFormInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useAppForm<LoginFormValues>({
    schema: loginSchema,
    defaultValues: { email: '', password: '', rememberMe: true },
  })

  const { handleSubmit, formState: { isSubmitting }, control } = form

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      const res = await fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: values.email,
          password: values.password,
        }),
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? 'Admin sign in failed')
      }

      useAdminSessionStore.getState().setSession({
        admin: json.data.admin,
        accessToken: json.data.accessToken,
      })

      const redirect = searchParams.get('redirect') || '/admin/dashboard'
      router.push(redirect)
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Admin sign in failed')
    }
  })

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Platform Admin</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Sign in to access the admin dashboard</p>
        </div>
      </div>

      <FormProvider {...form}>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormInput name="email" label="Admin email" type="email" autoComplete="username" required />
          <Controller
            name="password"
            control={control}
            render={({ field, fieldState }) => (
              <FormField name="password" label="Password" required error={fieldState.error?.message}>
                <PasswordInput
                  {...field}
                  autoComplete="current-password"
                  error={fieldState.error?.message}
                  showErrorMessage={false}
                />
              </FormField>
            )}
          />

          {serverError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {serverError}
            </p>
          )}

          <Button type="submit" className="w-full" loading={isSubmitting}>
            Sign in to admin
          </Button>
        </form>
      </FormProvider>

      <p className="mt-6 text-center text-xs text-slate-400">
        Tenant user?{' '}
        <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
          Go to main app login
        </Link>
      </p>
    </div>
  )
}

export function AdminLoginForm() {
  return (
    <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />}>
      <AdminLoginFormInner />
    </Suspense>
  )
}
