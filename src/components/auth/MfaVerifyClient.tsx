'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, CardBody, Input } from '@/components/ui'
import { useSessionStore } from '@/store/sessionStore'

export function MfaVerifyClient() {
  const router = useRouter()
  const { accessToken, setSession, setTokens, user, tenant } = useSessionStore()
  const [code, setCode] = useState('')
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
        body: JSON.stringify({ code, issueFullSession: true }),
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
      } else {
        setTokens(json.data.accessToken)
      }

      router.push('/dashboard')
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
            Enter the 6-digit code from your authenticator app.
          </p>
        </div>
        <Input
          label="Authentication code"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          autoFocus
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button variant="primary" className="w-full" onClick={verify} loading={loading} disabled={code.length !== 6}>
          Verify & continue
        </Button>
      </CardBody>
    </Card>
  )
}
