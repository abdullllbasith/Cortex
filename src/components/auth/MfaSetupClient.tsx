'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, CardBody, Input } from '@/components/ui'
import { useSessionStore } from '@/store/sessionStore'

export function MfaSetupClient() {
  const router = useRouter()
  const accessToken = useSessionStore((s) => s.accessToken)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [setupToken, setSetupToken] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!accessToken) return
    fetch('/api/auth/mfa/enable', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setQrCode(json.data.qrCodeDataUrl)
          setSetupToken(json.data.setupToken)
        }
      })
      .catch(() => setError('Failed to initialize MFA'))
  }, [accessToken])

  async function enable() {
    if (!accessToken || !setupToken) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, setupToken }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error?.message ?? 'Invalid code')
      router.push('/settings/security')
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
            Set up two-factor authentication
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Scan the QR code with your authenticator app, then enter the 6-digit code.
          </p>
        </div>

        {qrCode ? (
          <div className="flex flex-col items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCode} alt="TOTP QR code" className="h-48 w-48 rounded-lg border border-slate-200 dark:border-slate-700" />
            <Input
              label="Verification code"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button variant="primary" onClick={enable} loading={loading} disabled={code.length !== 6}>
              Enable MFA
            </Button>
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
            <span className="text-sm text-slate-400">Generating QR code…</span>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
