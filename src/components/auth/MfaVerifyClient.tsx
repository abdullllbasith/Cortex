'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button, Card, CardBody, Input } from '@/components/ui'
import { useSessionStore } from '@/store/sessionStore'
import { readRememberMePreference } from '@/lib/auth/rememberMe'

export function MfaVerifyClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { accessToken, setSession, setTokens, user, tenant } = useSessionStore()
  const [code, setCode] = useState('')
  const [useBackup, setUseBackup] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function verify() {
    if (!accessToken) {
      router.push('/login')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ code, rememberMe: readRememberMePreference() }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error?.message ?? 'Invalid code')

      if (user && tenant) {
        setSession({
          user,
          tenant,
          permissions: json.data.permissions,
          accessToken: json.data.accessToken,
        })
        const { hydrateSessionFromServer } = await import('@/lib/auth/sessionClient')
        await hydrateSessionFromServer()
      } else {
        setTokens(json.data.accessToken)
      }

      const redirect = searchParams.get('redirect') ?? '/dashboard'
      router.push(redirect)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardBody className="space-y-6 p-6">
        <div>
          <h1 className="font-display text-xl font-semibold text-slate-900 dark:text-slate-100">
            Two-factor verification
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {useBackup
              ? 'Enter one of your 8-character backup codes.'
              : 'Enter the 6-digit code from your authenticator app.'}
          </p>
        </div>
        <Input
          label={useBackup ? 'Backup code' : 'Authentication code'}
          inputMode={useBackup ? 'text' : 'numeric'}
          maxLength={useBackup ? 12 : 6}
          value={code}
          onChange={(e) => {
            const raw = useBackup
              ? e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()
              : e.target.value.replace(/\D/g, '').slice(0, 6)
            setCode(raw)
          }}
          placeholder={useBackup ? 'ABCD1234' : '000000'}
          autoFocus
        />
        <button
          type="button"
          className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
          onClick={() => {
            setUseBackup((v) => !v)
            setCode('')
            setError(null)
          }}
        >
          {useBackup ? 'Use authenticator app instead' : 'Use a backup code instead'}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button
          variant="primary"
          className="w-full"
          onClick={verify}
          loading={loading}
          disabled={useBackup ? code.length < 8 : code.length !== 6}
        >
          Verify & continue
        </Button>
      </CardBody>
    </Card>
  )
}
