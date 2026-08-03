'use client'

import useSWR from 'swr'
import { apiClient } from '@/lib/api/apiClient'
import { queryKeys } from '@/lib/api/queryKeys'
import type { User, Tenant, TeamMember } from '@/lib/api/types'

export function useCurrentUser() {
  return useSWR<User>(
    queryKeys.session.user,
    () => apiClient.get<User>('/session/me'),
  )
}

export function useTenant() {
  return useSWR<Tenant>(
    queryKeys.session.tenant,
    () => apiClient.get<Tenant>('/session/tenant'),
  )
}

export function useTeamMembers() {
  return useSWR<TeamMember[]>(
    queryKeys.session.team,
    () => apiClient.get<TeamMember[]>('/session/team'),
  )
}
