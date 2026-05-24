'use client'

import { useEffect } from 'react'
import { useSessionStore } from '@/store/sessionStore'
import { apiClient } from '@/lib/api/apiClient'

/** Ensures a dev session with the real seeded tenant exists for API calls. */
export function DevSessionBootstrap() {
  const tenant = useSessionStore((s) => s.tenant)
  const setSession = useSessionStore((s) => s.setSession)

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    const accessToken = useSessionStore.getState().accessToken
    const needsBootstrap =
      !tenant?.id ||
      tenant.id === 'dev-tenant-1' ||
      accessToken === 'dev-token'

    if (!needsBootstrap) return

    apiClient
      .get<{
        id: string
        name: string
        slug: string
        plan: string
        user?: { id: string; email: string; name: string; role: string } | null
      }>(
        tenant?.id ? `/dev/tenant?tenantId=${encodeURIComponent(tenant.id)}` : '/dev/tenant',
        { public: true },
      )
      .then((tenantData) => {
        if (!tenantData?.id) return
        const current = useSessionStore.getState().user
        setSession({
          user: {
            id: tenantData.user?.id ?? tenantData.id,
            email: tenantData.user?.email ?? current?.email ?? 'dev@acme.local',
            name: tenantData.user?.name ?? current?.name ?? 'Dev User',
            role: tenantData.user?.role ?? current?.role ?? 'admin',
            avatarUrl: current?.avatarUrl,
          },
          tenant: { id: tenantData.id, name: tenantData.name, slug: tenantData.slug, plan: tenantData.plan },
          permissions: ['*'],
          accessToken: 'dev-token',
        })
      })
      .catch(() => {
        /* dev bootstrap optional */
      })
  }, [tenant?.id, setSession])

  return null
}
