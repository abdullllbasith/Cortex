'use client'

import { useMemo, useState, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { FormProvider, type FieldPath } from 'react-hook-form'
import confetti from 'canvas-confetti'
import {
  Upload, Plug, Database, Check, Plus, Trash2, Sparkles, Zap,
} from 'lucide-react'
import { Button, Badge, Avatar } from '@/components/ui'
import { Card, CardBody } from '@/components/ui/Card'
import { FormInput, FormSelect, FormStepper, type FormStep } from '@/components/forms'
import { useAppForm } from '@/lib/forms/formConfig'
import { setupSchema, type SetupFormValues } from '@/lib/onboarding/schemas'
import {
  INDUSTRIES, COMPANY_SIZES, TIMEZONES, CURRENCIES, FISCAL_MONTHS, WORKFLOW_TEMPLATES,
} from '@/lib/auth/constants'
import { signOut } from '@/lib/supabase/auth'
import { cn } from '@/lib/utils'

function parseCsvPreview(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split('\n').slice(0, 6)
  const rows = lines.map((l) => l.split(',').map((c) => c.trim().replace(/^"|"$/g, '')))
  return { headers: rows[0] ?? [], rows: rows.slice(1) }
}

function detectCsvType(headers: string[]): 'products' | 'customers' {
  const h = headers.map((x) => x.toLowerCase())
  if (h.some((x) => x.includes('sku') || x.includes('price') || x.includes('stock'))) return 'products'
  return 'customers'
}

export function SetupWizard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialStep = searchParams.get('step') === '3' ? 2 : 0

  useEffect(() => {
    if (initialStep > 0) {
      sessionStorage.setItem(
        'saios:setup-stepper',
        JSON.stringify({ step: initialStep, completed: Array.from({ length: initialStep }, (_, i) => i) }),
      )
    }
  }, [initialStep])

  const [csvPreview, setCsvPreview] = useState<{ headers: string[]; rows: string[][] } | null>(null)

  const form = useAppForm<SetupFormValues>({
    schema: setupSchema,
    defaultValues: {
      businessName: '',
      industry: '',
      companySize: '1-10',
      timezone: 'America/New_York',
      currency: 'USD',
      fiscalYearStart: 'January',
      importMethod: 'demo',
      workflowTemplate: '',
      invites: [{ email: '', role: 'member' }],
    },
  })

  const industry = form.watch('industry')
  const importMethod = form.watch('importMethod')
  const invites = form.watch('invites')

  const workflows = useMemo(
    () => WORKFLOW_TEMPLATES.filter(
      (w) => !industry || (w.industries as readonly string[]).includes(industry) || w.industries.includes('Other'),
    ),
    [industry],
  )

  const handleCsvUpload = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const preview = parseCsvPreview(text)
      setCsvPreview(preview)
      form.setValue('detectedType', detectCsvType(preview.headers))
      form.setValue('csvFile', file)
      form.setValue('importMethod', 'csv')
    }
    reader.readAsText(file)
  }, [form])

  const addInvite = () => {
    const current = form.getValues('invites')
    if (current.length < 5) {
      form.setValue('invites', [...current, { email: '', role: 'member' }])
    }
  }

  const removeInvite = (index: number) => {
    const current = form.getValues('invites')
    if (current.length > 1) {
      form.setValue('invites', current.filter((_, i) => i !== index))
    }
  }

  const onComplete = form.handleSubmit(async () => {
    confetti({ particleCount: 180, spread: 80, origin: { y: 0.55 } })
    sessionStorage.removeItem('saios:setup-stepper')
    router.push('/dashboard')
  })

  const industryOptions = INDUSTRIES.map((i) => ({ value: i, label: i }))
  const timezoneOptions = TIMEZONES.map((t) => ({ value: t.value, label: t.label }))
  const currencyOptions = CURRENCIES.map((c) => ({ value: c.value, label: `${c.flag} ${c.label}` }))
  const fiscalOptions = FISCAL_MONTHS.map((m) => ({ value: m, label: m }))

  const steps: FormStep<SetupFormValues>[] = [
    {
      id: 'company',
      title: 'Company',
      description: 'Tell us about your business',
      fields: ['businessName', 'industry', 'companySize', 'timezone', 'currency', 'fiscalYearStart'],
      content: (
        <div className="space-y-4">
          <FormInput name="businessName" label="Business name" required />
          <FormSelect name="industry" label="Industry" data={industryOptions} placeholder="Select industry" required />
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Company size</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {COMPANY_SIZES.map((size) => (
                <label
                  key={size.value}
                  className={cn(
                    'flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2.5 text-center text-xs font-medium transition-colors',
                    form.watch('companySize') === size.value
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400',
                  )}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    value={size.value}
                    {...form.register('companySize')}
                  />
                  {size.label}
                </label>
              ))}
            </div>
          </fieldset>
          <FormSelect name="timezone" label="Timezone" data={timezoneOptions} required />
          <FormSelect name="currency" label="Currency" data={currencyOptions} required />
          <FormSelect name="fiscalYearStart" label="Fiscal year starts" data={fiscalOptions} required />
        </div>
      ),
    },
    {
      id: 'import',
      title: 'Import',
      description: 'Bring your data into SAIOS',
      fields: ['importMethod'],
      content: (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { id: 'csv' as const, icon: Upload, title: 'Upload CSV', desc: 'Import products or customers' },
              { id: 'integration' as const, icon: Plug, title: 'Connect Integration', desc: 'Sync from your tools', badge: 'Coming soon' },
              { id: 'demo' as const, icon: Database, title: 'Start with demo data', desc: '60 customers, 40 products, 3 months history' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={opt.id === 'integration'}
                onClick={() => form.setValue('importMethod', opt.id)}
                className={cn(
                  'relative flex flex-col items-start rounded-xl border p-4 text-left transition-all',
                  importMethod === opt.id
                    ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600 dark:bg-indigo-950/30'
                    : 'border-slate-200 hover:border-slate-300 dark:border-slate-700',
                  opt.id === 'integration' && 'opacity-60 cursor-not-allowed',
                )}
              >
                {opt.badge && (
                  <Badge variant="warning" size="sm" className="absolute -top-2 right-2">
                    {opt.badge}
                  </Badge>
                )}
                <opt.icon className="mb-2 h-5 w-5 text-indigo-600" />
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{opt.title}</p>
                <p className="mt-1 text-xs text-slate-500">{opt.desc}</p>
              </button>
            ))}
          </div>

          {importMethod === 'csv' && (
            <div
              className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 px-6 py-10 dark:border-slate-700"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const file = e.dataTransfer.files[0]
                if (file) handleCsvUpload(file)
              }}
            >
              <Upload className="mb-3 h-8 w-8 text-slate-400" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Drop CSV here or browse</p>
              <input
                type="file"
                accept=".csv"
                className="mt-3 text-xs text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleCsvUpload(file)
                }}
              />
            </div>
          )}

          {csvPreview && importMethod === 'csv' && (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Detected: {form.watch('detectedType')} · Preview (first 5 rows)
                </p>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    {csvPreview.headers.map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvPreview.rows.map((row, i) => (
                    <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                      {row.map((cell, j) => (
                        <td key={j} className="px-3 py-2 text-slate-700 dark:text-slate-300">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {importMethod === 'demo' && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/30">
              <p className="flex items-center gap-2 text-sm text-emerald-800 dark:text-emerald-300">
                <Sparkles className="h-4 w-4" />
                Demo dataset includes 60 customers, 40 products, and 3 months of transaction history.
              </p>
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'automation',
      title: 'Automation',
      description: 'Activate your first AI workflow',
      fields: [] as FieldPath<SetupFormValues>[],
      content: (
        <div className="space-y-4">
          <div className="grid gap-3">
            {workflows.map((wf) => {
              const selected = form.watch('workflowTemplate') === wf.id
              return (
                <button
                  key={wf.id}
                  type="button"
                  onClick={() => form.setValue('workflowTemplate', wf.id)}
                  className={cn(
                    'flex items-start gap-4 rounded-xl border p-4 text-left transition-all',
                    selected
                      ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600 dark:bg-indigo-950/30'
                      : 'border-slate-200 hover:border-slate-300 dark:border-slate-700',
                  )}
                >
                  <div className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                    selected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300',
                  )}>
                    {selected && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{wf.name}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{wf.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => form.setValue('workflowTemplate', '')}
            className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            Skip for now
          </button>
        </div>
      ),
    },
    {
      id: 'team',
      title: 'Team',
      description: 'Invite colleagues to your workspace',
      fields: ['invites'],
      content: (
        <div className="space-y-4">
          {invites.map((_, index) => (
            <div key={index} className="flex items-end gap-2">
              <div className="flex-1">
                <FormInput
                  name={`invites.${index}.email` as 'invites.0.email'}
                  label={index === 0 ? 'Email address' : undefined}
                  type="email"
                  placeholder="colleague@company.com"
                />
              </div>
              <FormSelect
                name={`invites.${index}.role` as 'invites.0.role'}
                label={index === 0 ? 'Role' : undefined}
                data={[
                  { value: 'admin', label: 'Admin' },
                  { value: 'member', label: 'Member' },
                  { value: 'viewer', label: 'Viewer' },
                ]}
                size="sm"
              />
              {invites.length > 1 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => removeInvite(index)} aria-label="Remove invite">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}

          {invites.length < 5 && (
            <button type="button" onClick={addInvite} className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400">
              <Plus className="h-4 w-4" /> Add another
            </button>
          )}

          {invites.some((i) => i.email) && (
            <div className="flex flex-wrap gap-2 pt-2">
              {invites.filter((i) => i.email).map((inv, i) => (
                <div key={i} className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 dark:border-slate-700">
                  <Avatar name={inv.email} size="xs" />
                  <span className="text-xs text-slate-600 dark:text-slate-400">{inv.email}</span>
                  <Badge variant="default" size="sm">{inv.role}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    },
  ]

  return (
    <FormProvider {...form}>
      <Card>
        <CardBody className="p-6 sm:p-8">
          <FormStepper<SetupFormValues>
            steps={steps}
            storageKey="saios:setup-stepper"
            onComplete={onComplete}
          />
        </CardBody>
      </Card>
    </FormProvider>
  )
}

export function SetupHeader() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600">
          <Zap className="h-4 w-4 text-white" aria-hidden="true" />
        </div>
        <span className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">SAIOS</span>
      </div>
      <Button variant="ghost" size="sm" onClick={() => signOut().then(() => { window.location.href = '/login' })}>
        Log out
      </Button>
    </header>
  )
}
