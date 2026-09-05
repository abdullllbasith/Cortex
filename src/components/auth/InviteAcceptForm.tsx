'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { FormProvider } from 'react-hook-form'
import { Button, Card, CardBody, Spinner } from '@/components/ui'
import { FormInput } from '@/components/forms'
import { useAppForm } from '@/lib/forms/formConfig'
import { inviteAcceptSchema, type InviteAcceptValues } from '@/lib/auth/schemas'
import { applyAuthSession } from '@/lib/auth/sessionClient'
import { createSupabaseBrowserClient } from '@/lib/auth/supabaseClient'
import { PasswordStrengthMeter } from './PasswordStrengthMeter'

interface InviteData {
  inviterName: string
  companyName: string
  email: string
  roleLabel?: string
}

async function fetchInvite(token: string): Promise<InviteData> {
  const res = await fetch(`/api/auth/invite/${encodeURIComponent(token)}`)
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) {
    throw new Error(json?.error?.message ?? 'Invalid invitation')
  }
  return json.data as InviteData
}

export function InviteAcceptForm({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null)

  const { data: invite, error: loadError, isLoading } = useSWR(
    ['invite', token],
    () => fetchInvite(token),
    { shouldRetryOnError: false },
  )

  const form = useAppForm<InviteAcceptValues>({
    schema: inviteAcceptSchema,
    defaultValues: { password: '', confirmPassword: '' },
  })

  const password = form.watch('password')

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      const res = await fetch(`/api/auth/invite/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          password: values.password,
          confirmPassword: values.confirmPassword,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message ?? 'Failed to accept invitation')
      }

      applyAuthSession({
        user: json.data.user,
        tenant: json.data.tenant,
        permissions: json.data.permissions ?? [],
        accessToken: json.data.accessToken,
      })

      // Establish Supabase SSR cookies so middleware and client auth stay aligned.
      const supabase = createSupabaseBrowserClient()
      if (supabase && invite?.email) {
        await supabase.auth.signInWithPassword({
          email: invite.email,
          password: values.password,
        }).catch(() => {
          /* App session cookie is already set; Supabase sync is best-effort */
        })
      }

      // Hard navigation ensures httpOnly refresh cookie is sent on the next request.
      window.location.assign('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation')
    }
  })

  if (isLoading) {
    return (
      <Card>
        <CardBody className="flex items-center justify-center p-12">
          <Spinner size="md" />
        </CardBody>
      </Card>
    )
  }

  if (loadError || !invite) {
    return (
      <Card>
        <CardBody className="space-y-4 p-8 text-center">
          <h1 className="font-display text-xl font-semibold text-slate-900 dark:text-slate-100">
            Invitation unavailable
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {loadError instanceof Error
              ? loadError.message
              : 'This invitation link is invalid or has expired.'}
          </p>
          <Link href="/login">
            <Button variant="primary">Go to sign in</Button>
          </Link>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card>
      <CardBody className="p-8">
        <h1 className="font-display text-xl font-semibold text-slate-900 dark:text-slate-100">
          You&apos;ve been invited
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          <span className="font-medium text-slate-700 dark:text-slate-300">{invite.inviterName}</span>
          {' '}invited you to join{' '}
          <span className="font-medium text-slate-700 dark:text-slate-300">{invite.companyName}</span>
          {' '}on Cortex
          {invite.roleLabel ? (
            <>
              {' '}as{' '}
              <span className="font-medium text-slate-700 dark:text-slate-300">{invite.roleLabel}</span>
            </>
          ) : null}
          .
        </p>
        {invite.email && (
          <p className="mt-1 text-xs text-slate-400">
            Accepting for <span className="font-mono">{invite.email}</span>
          </p>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
            {error}
            {/already|sign in/i.test(error) && (
              <div className="mt-2">
                <Link href="/login" className="font-medium underline underline-offset-2">
                  Sign in
                </Link>
              </div>
            )}
          </div>
        )}

        <FormProvider {...form}>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <FormInput
                name="password"
                label="Create password"
                type="password"
                required
                autoComplete="new-password"
              />
              <PasswordStrengthMeter password={password ?? ''} />
            </div>
            <FormInput
              name="confirmPassword"
              label="Confirm password"
              type="password"
              required
              autoComplete="new-password"
            />
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              loading={form.formState.isSubmitting}
            >
              Accept invitation
            </Button>
          </form>
        </FormProvider>
      </CardBody>
    </Card>
  )
}
