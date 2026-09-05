'use client'

import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Shield, ShieldCheck, ShieldOff } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardBody,
  Input,
  ModalRoot,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalTitle,
  ModalDescription,
  toast,
} from '@/components/ui'
import { authFetch, swrFetcher } from '@/lib/api/apiClient'

interface MfaStatus {
  mfaEnabled: boolean
  setupInProgress: boolean
  email: string
}

export function SecurityMfaCard() {
  const { data, mutate, isLoading, error: loadError } = useSWR<MfaStatus>(
    '/auth/mfa/status',
    swrFetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 0,
    },
  )
  const [disableOpen, setDisableOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [disabling, setDisabling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mfaEnabled = Boolean(data?.mfaEnabled)

  async function disableMfa() {
    if (!password.trim()) {
      setError('Enter your password to confirm')
      return
    }
    setDisabling(true)
    setError(null)
    try {
      const res = await authFetch('/api/auth/mfa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? 'Failed to disable MFA')
      }
      toast.success('Two-factor authentication disabled')
      setDisableOpen(false)
      setPassword('')
      await mutate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable MFA')
    } finally {
      setDisabling(false)
    }
  }

  return (
    <>
      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            {mfaEnabled ? (
              <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" aria-hidden="true" />
            ) : (
              <Shield className="mt-0.5 h-5 w-5 text-indigo-600" aria-hidden="true" />
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                  Two-factor authentication
                </h3>
                {!isLoading && !loadError && (
                  <Badge variant={mfaEnabled ? 'success' : 'default'} size="sm">
                    {mfaEnabled ? 'Enabled' : 'Off'}
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {mfaEnabled
                  ? 'Your account requires an authenticator code at sign-in.'
                  : data?.setupInProgress
                    ? 'Setup was started but not finished. Continue to complete it, or start over.'
                    : 'Protect your account with an authenticator app and backup codes.'}
              </p>
              {loadError && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  Could not load MFA status. Refresh the page or sign in again.
                </p>
              )}
            </div>
          </div>

          {isLoading ? (
            <Button size="sm" disabled>
              Loading…
            </Button>
          ) : mfaEnabled ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setError(null)
                setPassword('')
                setDisableOpen(true)
              }}
            >
              <ShieldOff className="mr-1.5 h-4 w-4" />
              Disable MFA
            </Button>
          ) : (
            <Link href="/mfa/setup">
              <Button size="sm">
                {data?.setupInProgress ? 'Continue MFA setup' : 'Set up MFA'}
              </Button>
            </Link>
          )}
        </CardBody>
      </Card>

      <ModalRoot
        open={disableOpen}
        onOpenChange={(open) => {
          setDisableOpen(open)
          if (!open) {
            setPassword('')
            setError(null)
          }
        }}
      >
        <ModalContent size="sm">
          <ModalHeader>
            <ModalTitle>Disable two-factor authentication</ModalTitle>
            <ModalDescription>
              Enter your account password to confirm. You can set MFA up again later from this page.
            </ModalDescription>
          </ModalHeader>
          <ModalBody className="space-y-3">
            <Input
              type="password"
              label="Password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void disableMfa()
              }}
              placeholder="Your current password"
            />
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          </ModalBody>
          <ModalFooter>
            <Button
              variant="secondary"
              onClick={() => setDisableOpen(false)}
              disabled={disabling}
            >
              Cancel
            </Button>
            <Button variant="danger" loading={disabling} onClick={() => void disableMfa()}>
              Disable MFA
            </Button>
          </ModalFooter>
        </ModalContent>
      </ModalRoot>
    </>
  )
}
