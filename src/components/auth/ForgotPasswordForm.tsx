'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FormProvider } from 'react-hook-form'
import { Button } from '@/components/ui'
import { Card, CardBody } from '@/components/ui/Card'
import { FormInput } from '@/components/forms'
import { useAppForm } from '@/lib/forms/formConfig'
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/lib/auth/schemas'
import { SuccessState } from './SuccessState'

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useAppForm<ForgotPasswordValues>({
    schema: forgotPasswordSchema,
    defaultValues: { email: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? 'Failed to send reset email')
      }
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email')
    }
  })

  if (sent) {
    return (
      <Card>
        <CardBody className="p-8">
          <SuccessState
            title="Check your email"
            description="We sent a password reset link to your inbox. It may take a few minutes to arrive."
          />
          <div className="mt-6 text-center">
            <Link href="/login" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
              Back to sign in
            </Link>
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card>
      <CardBody className="p-8">
        <h1 className="font-display text-xl font-semibold text-slate-900 dark:text-slate-100">
          Forgot your password?
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Enter your email and we&apos;ll send a reset link.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
            <p>{error}</p>
            {error.toLowerCase().includes('register') && (
              <p className="mt-2">
                <Link href="/register" className="font-medium underline hover:no-underline">
                  Create an account
                </Link>
              </p>
            )}
          </div>
        )}

        <FormProvider {...form}>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <FormInput name="email" label="Email" type="email" required autoComplete="email" />
            <Button type="submit" variant="primary" size="lg" className="w-full" loading={form.formState.isSubmitting}>
              Send reset link
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
