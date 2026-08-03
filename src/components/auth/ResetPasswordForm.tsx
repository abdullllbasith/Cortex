'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { FormProvider } from 'react-hook-form'
import { Button } from '@/components/ui'
import { Card, CardBody } from '@/components/ui/Card'
import { FormInput } from '@/components/forms'
import { useAppForm } from '@/lib/forms/formConfig'
import { resetPasswordSchema, type ResetPasswordValues } from '@/lib/auth/schemas'
import { PasswordStrengthMeter } from './PasswordStrengthMeter'
import { SuccessState } from './SuccessState'

export function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tokenHash = useMemo(() => {
    const raw = searchParams.get('token_hash')
    return raw ? decodeURIComponent(raw) : null
  }, [searchParams])

  const form = useAppForm<ResetPasswordValues>({
    schema: resetPasswordSchema,
    defaultValues: { password: '', confirmPassword: '' },
  })

  const password = form.watch('password')

  const onSubmit = form.handleSubmit(async (values) => {
    if (!tokenHash) {
      setError('Missing reset token. Request a new link from your email.')
      return
    }

    setError(null)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: values.password,
          confirmPassword: values.confirmPassword,
          token_hash: tokenHash,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? 'Failed to update password')
      }

      setDone(true)
      setTimeout(() => router.push('/login'), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password')
    }
  })

  if (!tokenHash) {
    return (
      <Card>
        <CardBody className="p-8">
          <h1 className="font-display text-xl font-semibold text-slate-900 dark:text-slate-100">
            Reset link required
          </h1>
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            This link is missing a reset token. Request a new one from your email.
          </p>
          <p className="mt-6 text-center text-sm text-slate-500">
            <Link href="/forgot-password" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
              Request a new reset link
            </Link>
          </p>
        </CardBody>
      </Card>
    )
  }

  if (done) {
    return (
      <Card>
        <CardBody className="p-8">
          <SuccessState
            title="Password updated"
            description="Your password has been reset successfully. Redirecting to sign in…"
          />
        </CardBody>
      </Card>
    )
  }

  return (
    <Card>
      <CardBody className="p-8">
        <h1 className="font-display text-xl font-semibold text-slate-900 dark:text-slate-100">
          Set new password
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Choose a strong password for your account.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
            {error}
          </div>
        )}

        <FormProvider {...form}>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <FormInput name="password" label="New password" type="password" required autoComplete="new-password" />
              <PasswordStrengthMeter password={password ?? ''} />
            </div>
            <FormInput name="confirmPassword" label="Confirm password" type="password" required autoComplete="new-password" />
            <Button type="submit" variant="primary" size="lg" className="w-full" loading={form.formState.isSubmitting}>
              Update password
            </Button>
          </form>
        </FormProvider>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
            Back to sign in
          </Link>
        </p>
      </CardBody>
    </Card>
  )
}
