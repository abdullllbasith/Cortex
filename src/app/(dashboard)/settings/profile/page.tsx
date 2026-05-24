'use client'

import { useEffect, useMemo, useState } from 'react'
import { FormProvider } from 'react-hook-form'
import useSWR from 'swr'
import { z } from 'zod'
import { LogOut, Monitor } from 'lucide-react'
import { PageHeader, Button, Skeleton, Avatar, Badge } from '@/components/ui'
import { toast } from '@/components/ui'
import { FormSection, FormInput, FormSelect, FormFileUpload } from '@/components/forms'
import { useAppForm } from '@/lib/forms/formConfig'
import { swrFetcher, apiClient } from '@/lib/api/apiClient'
import { TIMEZONES } from '@/lib/auth/constants'
import type { UserProfileDTO, UserSessionDTO } from '@/lib/settings/types'
import { updatePassword } from '@/lib/supabase/auth'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/sessionStore'

const schema = z.object({
  fullName: z.string().min(1),
  jobTitle: z.string().optional(),
  phone: z.string().optional(),
  avatarUrl: z.union([z.string(), z.object({ url: z.string() })]).optional(),
  timezone: z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
  confirmPassword: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

/** Radix Select rejects empty-string item values */
const WORKSPACE_DEFAULT_TIMEZONE = '__workspace_default__'

function toFormTimezone(tz: string | null | undefined): string {
  return tz || WORKSPACE_DEFAULT_TIMEZONE
}

function fromFormTimezone(tz: string | undefined): string | null {
  if (!tz || tz === WORKSPACE_DEFAULT_TIMEZONE) return null
  return tz
}

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: 'bg-slate-200' }
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  const labels = ['Weak', 'Fair', 'Good', 'Strong']
  const colors = ['bg-red-500', 'bg-amber-500', 'bg-blue-500', 'bg-emerald-500']
  return { score, label: labels[Math.max(0, score - 1)] ?? 'Weak', color: colors[Math.max(0, score - 1)] ?? 'bg-slate-200' }
}

export default function ProfileSettingsPage() {
  const { data: profile, isLoading, mutate } = useSWR<UserProfileDTO>(
    '/settings/profile',
    swrFetcher,
  )
  const { data: sessionsData, mutate: mutateSessions } = useSWR<{ sessions: UserSessionDTO[] }>(
    '/settings/sessions',
    swrFetcher,
  )

  const form = useAppForm({
    schema,
    defaultValues: {
      fullName: '',
      jobTitle: '',
      phone: '',
      avatarUrl: '',
      timezone: WORKSPACE_DEFAULT_TIMEZONE,
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  const newPassword = form.watch('newPassword') ?? ''
  const strength = useMemo(() => passwordStrength(newPassword), [newPassword])

  useEffect(() => {
    if (!profile) return
    form.reset({
      fullName: profile.fullName,
      jobTitle: profile.jobTitle ?? '',
      phone: profile.phone ?? '',
      avatarUrl: profile.avatarUrl ?? '',
      timezone: toFormTimezone(profile.timezone),
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    })
    useSessionStore.getState().updateUser({
      name: profile.fullName,
      avatarUrl: profile.avatarUrl ?? undefined,
    })
  }, [profile, form])

  async function onSubmit(values: FormValues) {
    try {
      if (values.newPassword && values.newPassword !== values.confirmPassword) {
        form.setError('confirmPassword', { message: 'Passwords do not match' })
        return
      }

      if (values.newPassword) {
        try {
          await updatePassword(values.newPassword)
          toast.success('Password updated')
        } catch {
          toast.error('Password update failed — use Supabase auth or reset flow')
        }
      }

      const avatar =
        typeof values.avatarUrl === 'object' && values.avatarUrl && 'url' in values.avatarUrl
          ? values.avatarUrl.url
          : (values.avatarUrl as string | undefined)

      const saved = await apiClient.put<UserProfileDTO>('/settings/profile', {
        fullName: values.fullName,
        jobTitle: values.jobTitle || null,
        phone: values.phone || null,
        avatarUrl: avatar || null,
        timezone: fromFormTimezone(values.timezone),
      })

      useSessionStore.getState().updateUser({
        name: saved.fullName,
        avatarUrl: saved.avatarUrl ?? undefined,
      })

      toast.success('Profile saved')
      void mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save profile')
    }
  }

  async function revokeSession(id: string) {
    await fetch(`/api/settings/sessions?id=${id}`, { method: 'DELETE', credentials: 'include' })
    toast.success('Session revoked')
    void mutateSessions()
  }

  async function revokeAllOthers() {
    await fetch('/api/settings/sessions?all=true', { method: 'DELETE', credentials: 'include' })
    toast.success('Other sessions logged out')
    void mutateSessions()
  }

  const sessions = sessionsData?.sessions ?? []

  if (isLoading && !profile) {
    return <div className="p-6"><Skeleton className="h-96 w-full rounded-xl" /></div>
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col">
        <PageHeader
          title="Profile"
          subtitle="Your personal account settings and active sessions"
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Settings', href: '/settings' },
            { label: 'Profile' },
          ]}
          actions={
            <Button type="submit" loading={form.formState.isSubmitting}>Save profile</Button>
          }
        />

        <div className="max-w-3xl space-y-6 p-6 pb-10">
          <FormSection title="Personal information">
            <div className="flex items-center gap-4 mb-2">
              <Avatar name={profile?.fullName ?? 'User'} size="lg" src={profile?.avatarUrl ?? undefined} />
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">{profile?.fullName}</p>
                <p className="text-sm text-slate-500">{profile?.email}</p>
                <Badge variant="outline" size="sm" className="mt-1">{profile?.role}</Badge>
              </div>
            </div>
            <FormFileUpload
              name="avatarUrl"
              label="Avatar"
              fileTypes={['image/png', 'image/jpeg', 'image/webp']}
              maxSize={2 * 1024 * 1024}
              bucket="uploads"
              pathPrefix="avatars"
            />
            <FormInput name="fullName" label="Full name" required />
            <FormInput name="jobTitle" label="Job title" />
            <FormInput name="phone" label="Phone" type="tel" />
            <FormSelect
              name="timezone"
              label="Timezone (personal override)"
              data={[
                { value: WORKSPACE_DEFAULT_TIMEZONE, label: 'Use workspace default' },
                ...TIMEZONES.map((t) => ({ value: t.value, label: t.label })),
              ]}
            />
          </FormSection>

          <FormSection title="Change password">
            <FormInput name="currentPassword" label="Current password" type="password" autoComplete="current-password" />
            <FormInput name="newPassword" label="New password" type="password" autoComplete="new-password" />
            {newPassword && (
              <div className="space-y-1">
                <div className="flex gap-1 h-1.5">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={cn('flex-1 rounded-full', i <= strength.score ? strength.color : 'bg-slate-200 dark:bg-slate-700')}
                    />
                  ))}
                </div>
                <p className="text-xs text-slate-500">Strength: {strength.label}</p>
              </div>
            )}
            <FormInput name="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password" />
          </FormSection>

          <FormSection title="Active sessions">
            <div className="flex justify-end mb-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => void revokeAllOthers()}>
                <LogOut className="h-4 w-4 mr-1" />
                Log out all other sessions
              </Button>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                    <th className="px-4 py-2 text-left font-medium">Device</th>
                    <th className="px-4 py-2 text-left font-medium">Location</th>
                    <th className="px-4 py-2 text-left font-medium">Last active</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} className="border-b border-slate-50 dark:border-slate-800/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Monitor className="h-4 w-4 text-slate-400" />
                          {s.device}
                          {s.isCurrent && <Badge variant="success" size="sm">Current</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{s.location}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDistanceToNow(new Date(s.lastActive), { addSuffix: true })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!s.isCurrent && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => void revokeSession(s.id)}>
                            Revoke
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {sessions.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-500">No active sessions</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </FormSection>
        </div>
      </form>
    </FormProvider>
  )
}
