'use client'

import { useCallback, useMemo, useState, type KeyboardEvent } from 'react'
import type { UserRole } from '@prisma/client'
import { Eye, Mail, Send, X } from 'lucide-react'
import {
  Button,
  toast,
} from '@/components/ui'
import {
  ModalRoot,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalTitle,
  ModalDescription,
} from '@/components/ui/Modal'
import {
  INVITABLE_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_KEY_PERMISSIONS,
  ROLE_LABELS,
  buildInviteEmailPreview,
} from '@/lib/settings/roleDefinitions'
import { cn } from '@/lib/utils'

const MAX_EMAILS = 10

export interface InviteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  seatsRemaining?: number
  tenantName?: string
  inviterName?: string
}

export function InviteModal({
  open,
  onOpenChange,
  onSuccess,
  seatsRemaining,
  tenantName = 'Your workspace',
  inviterName = 'A team admin',
}: InviteModalProps) {
  const [emailInput, setEmailInput] = useState('')
  const [emails, setEmails] = useState<string[]>([])
  const [role, setRole] = useState<UserRole>('EMPLOYEE')
  const [message, setMessage] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sentInvites, setSentInvites] = useState<Array<{ email: string; roleLabel: string }> | null>(
    null,
  )

  const addEmail = useCallback(
    (raw: string) => {
      const email = raw.trim().toLowerCase()
      if (!email) return
      const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      if (!valid) {
        toast.error('Enter a valid email address')
        return
      }
      if (emails.includes(email)) {
        toast.error('Email already added')
        return
      }
      if (emails.length >= MAX_EMAILS) {
        toast.error(`Maximum ${MAX_EMAILS} invitations at once`)
        return
      }
      if (seatsRemaining !== undefined && emails.length >= seatsRemaining) {
        toast.error('Not enough seats remaining on your plan')
        return
      }
      setEmails((prev) => [...prev, email])
      setEmailInput('')
    },
    [emails, seatsRemaining],
  )

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addEmail(emailInput)
    } else if (e.key === 'Backspace' && !emailInput && emails.length > 0) {
      setEmails((prev) => prev.slice(0, -1))
    }
  }

  const preview = useMemo(
    () =>
      buildInviteEmailPreview({
        tenantName,
        inviterName,
        roleLabel: ROLE_LABELS[role],
        customMessage: message,
        inviteUrl: `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/preview-token`,
      }),
    [tenantName, inviterName, role, message],
  )

  const reset = () => {
    setEmails([])
    setEmailInput('')
    setRole('EMPLOYEE')
    setMessage('')
    setShowPreview(false)
    setSentInvites(null)
  }

  const handleClose = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const submit = async () => {
    if (emails.length === 0) {
      toast.error('Add at least one email')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/tenants/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          invites: emails.map((email) => ({ email, role })),
          message: message.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error?.message ?? 'Failed to send invitations')
        return
      }
      setSentInvites(json.data.sent)
      toast.success(`Sent ${json.data.sent.length} invitation(s)`)
      onSuccess?.()
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalRoot open={open} onOpenChange={handleClose}>
      <ModalContent size="lg">
        <ModalHeader>
          <ModalTitle>Invite team members</ModalTitle>
          <ModalDescription>
            Add up to {MAX_EMAILS} email addresses. Press Enter after each email.
            {seatsRemaining !== undefined && (
              <span className="mt-1 block">Seats remaining: {seatsRemaining}</span>
            )}
          </ModalDescription>
        </ModalHeader>

        <ModalBody className="space-y-6">
          {sentInvites ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-emerald-600">Invitations sent successfully</p>
              <ul className="space-y-2 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                {sentInvites.map((inv) => (
                  <li key={inv.email} className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <span>{inv.email}</span>
                    <span className="text-slate-500">— {inv.roleLabel}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <div>
                <label className="mb-2 block text-sm font-medium">Email addresses</label>
                <div className="flex min-h-[42px] flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                  {emails.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                    >
                      {email}
                      <button
                        type="button"
                        onClick={() => setEmails((prev) => prev.filter((e) => e !== email))}
                        className="rounded-full p-0.5 hover:bg-indigo-100 dark:hover:bg-indigo-900"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={() => emailInput && addEmail(emailInput)}
                    placeholder={emails.length === 0 ? 'name@company.com' : ''}
                    className="min-w-[160px] flex-1 bg-transparent text-sm outline-none"
                  />
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-medium">Role</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {INVITABLE_ROLES.map((r) => (
                    <label
                      key={r}
                      className={cn(
                        'cursor-pointer rounded-lg border p-4 transition-colors',
                        role === r
                          ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
                          : 'border-slate-200 hover:border-slate-300 dark:border-slate-700',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="invite-role"
                          checked={role === r}
                          onChange={() => setRole(r)}
                          className="mt-1"
                        />
                        <div>
                          <p className="font-medium">{ROLE_LABELS[r]}</p>
                          <p className="mt-1 text-xs text-slate-500">{ROLE_DESCRIPTIONS[r]}</p>
                          <ul className="mt-2 space-y-0.5">
                            {ROLE_KEY_PERMISSIONS[r].map((p) => (
                              <li key={p} className="text-xs text-slate-400">
                                • {p}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Custom message <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Add a personal note to the invitation email…"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                />
              </div>

              {showPreview && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Email preview
                  </p>
                  <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 dark:text-slate-300">
                    {preview}
                  </pre>
                </div>
              )}
            </>
          )}
        </ModalBody>

        <ModalFooter>
          {sentInvites ? (
            <Button onClick={() => handleClose(false)}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setShowPreview((v) => !v)}>
                <Eye className="mr-2 h-4 w-4" />
                {showPreview ? 'Hide preview' : 'Preview email'}
              </Button>
              <Button variant="secondary" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button loading={loading} onClick={() => void submit()}>
                <Send className="mr-2 h-4 w-4" />
                Send invitations
              </Button>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </ModalRoot>
  )
}
