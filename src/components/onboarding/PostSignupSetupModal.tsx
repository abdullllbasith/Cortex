'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { Building2, Check, Moon, Sun, Upload, User } from 'lucide-react'
import {
  ModalRoot,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
  Button,
  Avatar,
  Input,
} from '@/components/ui'
import { toast } from '@/components/ui/Toast'
import { apiClient } from '@/lib/api/apiClient'
import { uploadToStorage } from '@/lib/supabase/client'
import { useSessionStore } from '@/store/sessionStore'
import { notifyBrandingUpdated } from '@/lib/branding/tenantBranding'
import { cn } from '@/lib/utils'

const SETUP_FLAG = 'saios:post-signup-setup'

function setupDoneKey(userId: string) {
  return `saios:quick-setup-done:${userId}`
}

const STEPS = [
  { id: 'workspace', title: 'Workspace', icon: Building2 },
  { id: 'profile', title: 'Profile', icon: User },
  { id: 'preferences', title: 'Preferences', icon: Moon },
] as const

function SimpleImageUpload({
  label,
  helperText,
  previewUrl,
  fallbackName,
  onUploaded,
  bucket,
  pathPrefix,
}: {
  label: string
  helperText?: string
  previewUrl?: string | null
  fallbackName: string
  onUploaded: (url: string | null) => void
  bucket: string
  pathPrefix: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB')
      return
    }

    setUploading(true)
    try {
      const ext = file.name.split('.').pop() ?? 'png'
      const path = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const result = await uploadToStorage(file, bucket, path)
      onUploaded(result.publicUrl)
    } catch {
      toast.error('Upload failed — try again or skip for now')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{label}</p>
      <div className="flex items-center gap-4">
        <Avatar name={fallbackName} size="lg" src={previewUrl ?? undefined} />
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
              e.target.value = ''
            }}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={uploading}
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="mr-1.5 h-4 w-4" />
            {previewUrl ? 'Change image' : 'Upload image'}
          </Button>
          {previewUrl && (
            <button
              type="button"
              className="text-left text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              onClick={() => onUploaded(null)}
            >
              Remove
            </button>
          )}
        </div>
      </div>
      {helperText && <p className="text-xs text-slate-500 dark:text-slate-400">{helperText}</p>}
    </div>
  )
}

export function PostSignupSetupModal() {
  const { setTheme } = useTheme()
  const user = useSessionStore((s) => s.user)
  const tenant = useSessionStore((s) => s.tenant)
  const updateUser = useSessionStore((s) => s.updateUser)
  const updateTenant = useSessionStore((s) => s.updateTenant)

  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  const [businessName, setBusinessName] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [themeChoice, setThemeChoice] = useState<'light' | 'dark'>('dark')

  useEffect(() => {
    if (!user?.id) return
    try {
      if (sessionStorage.getItem(SETUP_FLAG) !== '1') return
      if (localStorage.getItem(setupDoneKey(user.id)) === '1') {
        sessionStorage.removeItem(SETUP_FLAG)
        return
      }
      setBusinessName(tenant?.name ?? '')
      setFullName(user.name ?? '')
      setOpen(true)
    } catch { /* ignore */ }
  }, [user?.id, user?.name, tenant?.name])

  const finishSetup = useCallback(() => {
    if (user?.id) {
      try {
        localStorage.setItem(setupDoneKey(user.id), '1')
        sessionStorage.removeItem(SETUP_FLAG)
      } catch { /* ignore */ }
    }
    setOpen(false)
  }, [user?.id])

  const saveWorkspace = async () => {
    const payload: { name?: string; settings?: { logoUrl?: string | null } } = {}
    const trimmed = businessName.trim()
    if (trimmed) payload.name = trimmed
    if (logoUrl) payload.settings = { logoUrl }

    if (Object.keys(payload).length === 0) return

    const saved = await apiClient.put<{ name: string; settings: { logoUrl?: string | null } }>(
      '/settings/general',
      payload,
    )

    updateTenant({
      name: saved.name,
      logoUrl: saved.settings.logoUrl ?? undefined,
    })
    notifyBrandingUpdated({
      name: saved.name,
      logoUrl: saved.settings.logoUrl ?? null,
    })
  }

  const saveProfile = async () => {
    const trimmed = fullName.trim()
    const payload: { fullName?: string; avatarUrl?: string | null } = {}
    if (trimmed) payload.fullName = trimmed
    if (avatarUrl) payload.avatarUrl = avatarUrl

    if (Object.keys(payload).length === 0) return

    const saved = await apiClient.put<{ fullName: string; avatarUrl: string | null }>(
      '/settings/profile',
      payload,
    )
    updateUser({
      name: saved.fullName,
      avatarUrl: saved.avatarUrl ?? undefined,
    })
  }

  const savePreferences = async () => {
    setTheme(themeChoice)
    try {
      await apiClient.put('/settings/profile', {
        profileSettings: { theme: themeChoice },
      })
    } catch {
      /* theme still applied locally */
    }
  }

  const handleNext = async () => {
    setSaving(true)
    try {
      if (step === 0) await saveWorkspace()
      else if (step === 1) await saveProfile()
      else if (step === 2) {
        await savePreferences()
        toast.success('Setup complete', { description: 'Your workspace is ready to use.' })
        finishSetup()
        return
      }
      setStep((s) => s + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save — try again or skip')
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = () => {
    if (step >= STEPS.length - 1) {
      finishSetup()
      return
    }
    setStep((s) => s + 1)
  }

  if (!open) return null

  const isLast = step === STEPS.length - 1
  const progress = Math.round(((step + 1) / STEPS.length) * 100)

  return (
    <ModalRoot open={open} onOpenChange={() => { /* wizard is non-dismissable */ }}>
      <ModalContent size="md" hideClose className="overflow-hidden">
        <ModalHeader className="border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
            <span>Step {step + 1} of {STEPS.length}</span>
            <span>{progress}% complete</span>
          </div>
          <div className="mb-4 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-[#5BA8A0] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <ol className="mb-2 flex items-center">
            {STEPS.map((s, i) => {
              const Icon = s.icon
              const isActive = i === step
              const isDone = i < step
              return (
                <li key={s.id} className="flex flex-1 items-center">
                  <div className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors',
                        isDone
                          ? 'border-[#5BA8A0] bg-[#5BA8A0] text-white'
                          : isActive
                            ? 'border-[#5BA8A0] bg-white text-[#5BA8A0] dark:bg-slate-900'
                            : 'border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-900',
                      )}
                    >
                      {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
                    </div>
                    <span
                      className={cn(
                        'hidden text-[10px] font-medium sm:block',
                        isActive ? 'text-[#5BA8A0]' : 'text-slate-400',
                      )}
                    >
                      {s.title}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={cn(
                        'mx-1 h-0.5 flex-1',
                        isDone ? 'bg-[#5BA8A0]' : 'bg-slate-200 dark:bg-slate-700',
                      )}
                    />
                  )}
                </li>
              )
            })}
          </ol>

          <ModalTitle>
            {step === 0 && 'Set up your workspace'}
            {step === 1 && 'Complete your profile'}
            {step === 2 && 'Choose your preferences'}
          </ModalTitle>
          <ModalDescription>
            {step === 0 && 'Add your business name and logo so your team recognizes the workspace.'}
            {step === 1 && 'Upload a photo and confirm how your name appears across Cortex.'}
            {step === 2 && 'Pick a theme that feels right — you can change this anytime in settings.'}
          </ModalDescription>
        </ModalHeader>

        <ModalBody className="space-y-5">
          {step === 0 && (
            <>
              <div className="space-y-2">
                <label htmlFor="setup-business-name" className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Business name
                </label>
                <Input
                  id="setup-business-name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Acme Inc."
                />
              </div>
              <SimpleImageUpload
                label="Business logo"
                helperText="PNG or JPG, up to 5 MB. Shown in your sidebar and reports."
                previewUrl={logoUrl}
                fallbackName={businessName || 'Workspace'}
                onUploaded={setLogoUrl}
                bucket="uploads"
                pathPrefix="workspace-logos"
              />
            </>
          )}

          {step === 1 && (
            <>
              <div className="space-y-2">
                <label htmlFor="setup-full-name" className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Full name
                </label>
                <Input
                  id="setup-full-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                />
              </div>
              <SimpleImageUpload
                label="Profile photo"
                helperText="Optional — helps teammates recognize you."
                previewUrl={avatarUrl}
                fallbackName={fullName || (user?.name ?? 'User')}
                onUploaded={setAvatarUrl}
                bucket="uploads"
                pathPrefix="avatars"
              />
            </>
          )}

          {step === 2 && (
            <div className="grid grid-cols-2 gap-3">
              {(['light', 'dark'] as const).map((mode) => {
                const selected = themeChoice === mode
                const Icon = mode === 'light' ? Sun : Moon
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setThemeChoice(mode)}
                    className={cn(
                      'flex flex-col items-center gap-3 rounded-xl border-2 p-5 transition-all',
                      selected
                        ? 'border-[#5BA8A0] bg-[#5BA8A0]/5 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600',
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-full',
                        mode === 'light' ? 'bg-amber-100 text-amber-600' : 'bg-slate-800 text-slate-200',
                      )}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="text-sm font-semibold capitalize text-slate-900 dark:text-slate-100">
                      {mode} mode
                    </span>
                    {selected && (
                      <span className="text-xs font-medium text-[#5BA8A0]">Selected</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </ModalBody>

        <ModalFooter className="justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={handleSkip} disabled={saving}>
            Skip for now
          </Button>
          <Button type="button" variant="primary" size="sm" loading={saving} onClick={() => void handleNext()}>
            {isLast ? 'Finish setup' : 'Next'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </ModalRoot>
  )
}

export function markPostSignupSetupPending() {
  try {
    sessionStorage.setItem(SETUP_FLAG, '1')
  } catch { /* ignore */ }
}
