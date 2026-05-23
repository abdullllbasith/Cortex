'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { FormProvider } from 'react-hook-form'
import { Button, Card, CardBody, Spinner } from '@/components/ui'
import { FormInput } from '@/components/forms'
import { useAppForm } from '@/lib/forms/formConfig'
import { inviteAcceptSchema, type InviteAcceptValues } from '@/lib/auth/schemas'
import { updatePassword } from '@/lib/supabase/auth'
import { PasswordStrengthMeter } from './PasswordStrengthMeter'

interface InviteData {
  inviterName: string
  companyName: string
  email: string
}

async function fetchInvite(token: string): Promise<InviteData> {
  const res = await fetch(`/api/auth/invite/${token}`)
  if (!res.ok) throw new Error('Invalid invitation')
  return res.json()
}

export function InviteAcceptForm({ token }: { token: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const { data: invite, isLoading } = useSWR(['invite', token], () => fetchInvite(token))

  const form = useAppForm<InviteAcceptValues>({
    schema: inviteAcceptSchema,
    defaultValues: { password: '', confirmPassword: '' },
  })

  const password = form.watch('password')

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      await updatePassword(values.password)
      router.push('/setup?step=3')
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

  return (
    <Card>
      <CardBody className="p-8">
        <h1 className="font-display text-xl font-semibold text-slate-900 dark:text-slate-100">
          You&apos;ve been invited
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          <span className="font-medium text-slate-700 dark:text-slate-300">{invite?.inviterName}</span>
          {' '}invited you to join{' '}
          <span className="font-medium text-slate-700 dark:text-slate-300">{invite?.companyName}</span>
          {' '}on SAIOS.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
            {error}
          </div>
        )}

        <FormProvider {...form}>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <FormInput name="password" label="Create password" type="password" required autoComplete="new-password" />
              <PasswordStrengthMeter password={password ?? ''} />
            </div>
            <FormInput name="confirmPassword" label="Confirm password" type="password" required autoComplete="new-password" />
            <Button type="submit" variant="primary" size="lg" className="w-full" loading={form.formState.isSubmitting}>
              Accept invitation
            </Button>
          </form>
        </FormProvider>
      </CardBody>
    </Card>
  )
}
