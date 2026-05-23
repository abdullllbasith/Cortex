'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormProvider } from 'react-hook-form'
import { Button } from '@/components/ui'
import { Card, CardBody } from '@/components/ui/Card'
import { FormInput } from '@/components/forms'
import { useAppForm } from '@/lib/forms/formConfig'
import { resetPasswordSchema, type ResetPasswordValues } from '@/lib/auth/schemas'
import { updatePassword } from '@/lib/supabase/auth'
import { PasswordStrengthMeter } from './PasswordStrengthMeter'
import { SuccessState } from './SuccessState'

export function ResetPasswordForm() {
  const router = useRouter()
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useAppForm<ResetPasswordValues>({
    schema: resetPasswordSchema,
    defaultValues: { password: '', confirmPassword: '' },
  })

  const password = form.watch('password')

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      await updatePassword(values.password)
      setDone(true)
      setTimeout(() => router.push('/login'), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password')
    }
  })

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
