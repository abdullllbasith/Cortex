'use client'

import { useEffect } from 'react'
import { FormProvider } from 'react-hook-form'
import useSWR from 'swr'
import { z } from 'zod'
import { PageHeader, Button, Skeleton } from '@/components/ui'
import { toast } from '@/components/ui'
import {
  FormSection,
  FormInput,
  FormSelect,
  FormTextarea,
  FormFileUpload,
  FormColorPicker,
} from '@/components/forms'
import { useAppForm } from '@/lib/forms/formConfig'
import { swrFetcher, apiClient } from '@/lib/api/apiClient'
import {
  COMPANY_SIZES,
  CURRENCIES,
  FISCAL_MONTHS,
  INDUSTRIES,
  TIMEZONES,
} from '@/lib/auth/constants'
import type { TenantGeneralDTO } from '@/lib/settings/types'
import { DATE_FORMATS, LANGUAGES, NUMBER_FORMATS } from '@/lib/settings/types'
import { notifyBrandingUpdated } from '@/lib/branding/tenantBranding'

const schema = z.object({
  name: z.string().min(1),
  slug: z.string(),
  workspaceUrl: z.string(),
  logoUrl: z.union([z.string(), z.object({ url: z.string() })]).optional(),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  foundedYear: z.coerce.number().optional(),
  website: z.string().optional(),
  description: z.string().optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
  dateFormat: z.string().optional(),
  numberFormat: z.string().optional(),
  language: z.string().optional(),
  fiscalYearStartMonth: z.coerce.number().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

function currentFiscalYear(startMonth: number): string {
  const now = new Date()
  const year = now.getMonth() >= startMonth ? now.getFullYear() : now.getFullYear() - 1
  return `${year}–${year + 1}`
}

export default function GeneralSettingsPage() {
  const { data, isLoading, mutate } = useSWR<TenantGeneralDTO>(
    '/settings/general',
    swrFetcher,
  )

  const form = useAppForm({
    schema,
    defaultValues: {
      name: '',
      slug: '',
      workspaceUrl: '',
      industry: '',
      companySize: '',
      foundedYear: new Date().getFullYear(),
      website: '',
      description: '',
      timezone: 'America/New_York',
      currency: 'USD',
      dateFormat: 'MM/DD/YYYY',
      numberFormat: '1,234.56',
      language: 'en',
      fiscalYearStartMonth: 0,
      primaryColor: '#4F46E5',
      secondaryColor: '#0EA5E9',
    },
  })

  useEffect(() => {
    if (!data) return
    const s = data.settings
    form.reset({
      name: data.name,
      slug: data.slug,
      workspaceUrl: data.workspaceUrl,
      logoUrl: s.logoUrl ?? '',
      industry: s.industry ?? '',
      companySize: s.companySize ?? '',
      foundedYear: s.foundedYear ?? new Date().getFullYear(),
      website: s.website ?? '',
      description: s.description ?? '',
      timezone: s.timezone ?? 'America/New_York',
      currency: s.currency ?? 'USD',
      dateFormat: s.dateFormat ?? 'MM/DD/YYYY',
      numberFormat: s.numberFormat ?? '1,234.56',
      language: s.language ?? 'en',
      fiscalYearStartMonth: s.fiscalYearStartMonth ?? 0,
      primaryColor: s.primaryColor ?? '#4F46E5',
      secondaryColor: s.secondaryColor ?? '#0EA5E9',
    })
  }, [data, form])

  async function onSubmit(values: FormValues) {
    const logo =
      typeof values.logoUrl === 'object' && values.logoUrl && 'url' in values.logoUrl
        ? values.logoUrl.url
        : (values.logoUrl as string | undefined)

    await apiClient.put('/settings/general', {
      name: values.name,
      settings: {
        logoUrl: logo || undefined,
        industry: values.industry,
        companySize: values.companySize,
        foundedYear: values.foundedYear,
        website: values.website,
        description: values.description,
        timezone: values.timezone,
        currency: values.currency,
        dateFormat: values.dateFormat,
        numberFormat: values.numberFormat,
        language: values.language,
        fiscalYearStartMonth: values.fiscalYearStartMonth,
        primaryColor: values.primaryColor,
        secondaryColor: values.secondaryColor,
      },
    })
    toast.success('Workspace settings saved')
    notifyBrandingUpdated({
      logoUrl: logo || null,
      primaryColor: values.primaryColor,
      secondaryColor: values.secondaryColor,
    })
    void mutate()
  }

  const fiscalMonth = form.watch('fiscalYearStartMonth') ?? 0
  const currency = form.watch('currency') ?? 'USD'
  const currencyMeta = CURRENCIES.find((c) => c.value === currency)

  if (isLoading && !data) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-64 mb-6" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col">
        <PageHeader
          title="General"
          subtitle="Workspace identity, regional preferences, and branding"
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Settings', href: '/settings' },
            { label: 'General' },
          ]}
          actions={
            <Button type="submit" loading={form.formState.isSubmitting}>
              Save changes
            </Button>
          }
        />

        <div className="max-w-3xl space-y-6 p-6 pb-10">
          <FormSection title="Workspace Identity" description="How your workspace appears across SAIOS">
            <FormFileUpload
              name="logoUrl"
              label="Workspace logo"
              helperText="PNG or JPG, max 512×512, 2 MB"
              fileTypes={['image/png', 'image/jpeg', 'image/webp']}
              maxSize={2 * 1024 * 1024}
              bucket="uploads"
              pathPrefix="workspace-logos"
            />
            <FormInput name="name" label="Workspace name" required />
            <FormInput name="slug" label="Workspace slug" disabled helperText="Slug cannot be changed after creation" />
            <FormInput name="workspaceUrl" label="Workspace URL" disabled />
          </FormSection>

          <FormSection title="Business Information">
            <FormSelect
              name="industry"
              label="Industry"
              data={INDUSTRIES.map((i) => ({ value: i, label: i }))}
            />
            <FormSelect
              name="companySize"
              label="Company size"
              data={COMPANY_SIZES.map((c) => ({ value: c.value, label: c.label }))}
            />
            <FormInput name="foundedYear" label="Founded year" type="number" />
            <FormInput name="website" label="Website" placeholder="https://example.com" />
            <FormTextarea name="description" label="Description" rows={4} />
          </FormSection>

          <div id="regional">
          <FormSection title="Regional Settings">
            <FormSelect
              name="timezone"
              label="Timezone"
              data={TIMEZONES.map((t) => ({ value: t.value, label: t.label }))}
            />
            <FormSelect
              name="currency"
              label="Currency"
              data={CURRENCIES.map((c) => ({ value: c.value, label: c.label }))}
              helperText={currencyMeta ? `Symbol preview: ${currencyMeta.flag} ${currencyMeta.value}` : undefined}
            />
            <FormSelect name="dateFormat" label="Date format" data={[...DATE_FORMATS]} />
            <FormSelect name="numberFormat" label="Number format" data={[...NUMBER_FORMATS]} />
            <FormSelect name="language" label="Language" data={[...LANGUAGES]} />
          </FormSection>
          </div>

          <FormSection title="Fiscal Year">
            <FormSelect
              name="fiscalYearStartMonth"
              label="Fiscal year starts"
              data={FISCAL_MONTHS.map((m, i) => ({ value: String(i), label: m }))}
            />
            <p className="text-sm text-slate-500">
              Current fiscal year: <strong>{currentFiscalYear(Number(fiscalMonth))}</strong>
            </p>
          </FormSection>

          <div id="branding">
          <FormSection title="Branding">
            <FormColorPicker name="primaryColor" label="Primary color" />
            <FormColorPicker name="secondaryColor" label="Secondary color" />
            <div
              className="rounded-lg border p-4 flex items-center gap-3"
              style={{ borderColor: form.watch('primaryColor') }}
            >
              <div
                className="h-10 w-10 rounded-lg"
                style={{ backgroundColor: form.watch('primaryColor') }}
              />
              <div
                className="h-10 w-10 rounded-lg"
                style={{ backgroundColor: form.watch('secondaryColor') }}
              />
              <div>
                <p className="text-sm font-medium">Theme preview</p>
                <p className="text-xs text-slate-500">Primary and accent colors apply across the dashboard after save</p>
              </div>
            </div>
          </FormSection>
          </div>

          <div id="danger">
          <FormSection title="Danger Zone" description="Irreversible workspace actions">
            <p className="text-sm text-slate-500">
              Export or delete workspace data requires owner approval. Contact support for workspace deletion.
            </p>
          </FormSection>
          </div>
        </div>
      </form>
    </FormProvider>
  )
}
