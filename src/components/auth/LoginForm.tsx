'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { FormProvider } from 'react-hook-form'
import { Button } from '@/components/ui'
import { FormInput, FormCheckbox } from '@/components/forms'
import { useAppForm } from '@/lib/forms/formConfig'
import { loginSchema, type LoginFormValues } from '@/lib/auth/schemas'
import { createSupabaseBrowserClient } from '@/lib/auth/supabaseClient'
import { applyAuthSession, hydrateSessionFromServer } from '@/lib/auth/sessionClient'
import { readRememberMePreference, writeRememberMePreference } from '@/lib/auth/rememberMe'
import { OAuthButtons } from './OAuthButtons'
import { PasswordInput } from './PasswordInput'
import { Controller } from 'react-hook-form'
import { FormField } from '@/components/forms/FormField'
import { SaiosBrandLockup } from '@/components/branding/SaiosBrandLockup'
import { DemoCredentialsPanel } from './DemoCredentialsPanel'

function getTenantSlugFromHost(): string | null {
  if (typeof window === 'undefined') return null
  const host = window.location.hostname
  if (host.endsWith('.saios.app')) {
    const slug = host.replace('.saios.app', '')
    if (slug && !['www', 'app'].includes(slug)) return slug
  }
  return null
}

async function bootstrapSession(payload: {
  email?: string
  password?: string
  supabaseAccessToken?: string
  rememberMe?: boolean
}, tenantSlug?: string | null) {
  const res = await fetch('/api/auth/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(tenantSlug ? { 'x-tenant-slug': tenantSlug } : {}),
    },
    body: JSON.stringify(payload),
    credentials: 'include',
  })

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error(
      res.ok
        ? 'Sign in returned an unexpected response. Please try again.'
        : 'Sign in is temporarily unavailable. Please try again in a moment.',
    )
  }

  const json = await res.json()
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? 'Sign in failed')
  }
  return json.data as {
    user: { id: string; email: string; name: string; role: string; avatarUrl?: string | null }
    tenant: {
      id: string
      name: string
      slug: string
      plan: string
      logoUrl?: string | null
      primaryColor?: string | null
      secondaryColor?: string | null
    }
    permissions: string[]
    accessToken: string
    mfaRequired?: boolean
  }
}

export function LoginForm() {
  const searchParams = useSearchParams()
  const [serverError, setServerError] = useState<string | null>(null)
  const [tenantSlug, setTenantSlug] = useState<string | null>(null)
  const [tenantLocked, setTenantLocked] = useState(false)

  useEffect(() => {
    const slug = getTenantSlugFromHost()
    if (slug) {
      setTenantSlug(slug)
      setTenantLocked(true)
    }
  }, [])

  const form = useAppForm<LoginFormValues & { tenantSlug?: string }>({
    schema: loginSchema,
    defaultValues: { email: '', password: '', rememberMe: true, tenantSlug: '' },
  })

  const { handleSubmit, formState: { isSubmitting }, setError, setValue, watch } = form
  const rememberMe = watch('rememberMe')

  const fillDemoCredentials = useCallback((email: string, password: string) => {
    setValue('email', email, { shouldDirty: true, shouldValidate: true })
    setValue('password', password, { shouldDirty: true, shouldValidate: true })
    setServerError(null)
  }, [setValue])

  useEffect(() => {
    setValue('rememberMe', readRememberMePreference())
  }, [setValue])

  useEffect(() => {
    writeRememberMePreference(Boolean(rememberMe))
  }, [rememberMe])

  useEffect(() => {
    if (tenantSlug) setValue('tenantSlug', tenantSlug)
  }, [tenantSlug, setValue])

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      const supabase = createSupabaseBrowserClient()
      let accessToken: string | undefined

      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        })
        if (error) throw error
        accessToken = data.session?.access_token
      }

      const result = await bootstrapSession(
        accessToken
          ? { supabaseAccessToken: accessToken, rememberMe: values.rememberMe }
          : { email: values.email, password: values.password, rememberMe: values.rememberMe },
        tenantSlug,
      )

      applyAuthSession({
        user: result.user,
        tenant: result.tenant,
        permissions: result.permissions,
        accessToken: result.accessToken,
      })

      if (!result.mfaRequired) {
        await hydrateSessionFromServer()
      }

      if (result.mfaRequired) {
        const mfaUrl = searchParams.get('redirect')
          ? `/mfa/verify?redirect=${encodeURIComponent(searchParams.get('redirect')!)}`
          : '/mfa/verify'
        window.location.assign(mfaUrl)
        return
      }

      const redirect = searchParams.get('redirect')
      const next =
        redirect && redirect.startsWith('/') && !redirect.startsWith('//')
          ? redirect
          : '/dashboard'
      // Hard navigation so the httpOnly refresh cookie is present for middleware.
      window.location.assign(next)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed'
      if (message.toLowerCase().includes('email')) {
        setError('email', { message })
      } else if (message.toLowerCase().includes('password') || message.toLowerCase().includes('credential')) {
        setError('password', { message: 'Invalid email or password' })
      } else {
        setServerError(message)
      }
    }
  })

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="space-y-7">
        <div className="lg:hidden">
          <SaiosBrandLockup surface="light" href="/" />
        </div>

        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Welcome back
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            {tenantLocked && tenantSlug
              ? `Sign in to ${tenantSlug}.cortex.app`
              : 'Sign in to your Cortex workspace'}
          </p>
        </div>

        {serverError && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
            {serverError}
          </div>
        )}

        {tenantLocked && tenantSlug && (
          <div className="rounded-lg border border-[#5BA8A0]/30 bg-[#5BA8A0]/8 px-4 py-3 text-sm dark:border-[#5BA8A0]/20 dark:bg-[#5BA8A0]/10">
            <span className="text-slate-500 dark:text-slate-400">Workspace: </span>
            <span className="font-medium text-slate-900 dark:text-slate-100">{tenantSlug}.cortex.app</span>
          </div>
        )}

        <DemoCredentialsPanel variant="login" onUseCredentials={fillDemoCredentials} />

        <div className="space-y-4">
          <FormInput name="email" label="Email" type="email" autoComplete="email" placeholder="you@company.com" required />
          <Controller
            name="password"
            control={form.control}
            render={({ field, fieldState }) => (
              <FormField name="password" label="Password" required error={fieldState.error?.message}>
                <PasswordInput
                  {...field}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  error={fieldState.error?.message}
                  showErrorMessage={false}
                />
              </FormField>
            )}
          />
        </div>

        <div className="space-y-3">
          <FormCheckbox name="rememberMe" label="Remember me for 30 days" />
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="auth-text-link text-sm font-semibold"
              style={{ textDecoration: 'none' }}
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <Button type="submit" variant="primary" size="lg" className="w-full" loading={isSubmitting}>
          Sign in
        </Button>

        <OAuthButtons tenantSlug={tenantSlug} />

        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          Don&apos;t have an account?{' '}
          <Link href="/register" style={{ textDecoration: 'none' }} className="font-medium text-[#5BA8A0] hover:text-[#3D8E87] dark:text-[#7ECAC3]">
            Start free trial
          </Link>
        </p>
      </form>
    </FormProvider>
  )
}
