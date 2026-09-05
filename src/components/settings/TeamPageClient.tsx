'use client'

import { useCallback, useMemo, useState } from 'react'
import useSWR from 'swr'
import {
  Mail,
  UserPlus,
  Users,
  Clock,
  RotateCcw,
} from 'lucide-react'
import type { UserRole } from '@prisma/client'
import {
  PageHeader,
  Button,
  Card,
  CardBody,
  Badge,
  Avatar,
  ConfirmDialog,
  toast,
} from '@/components/ui'
import {
  ModalRoot,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalTitle,
} from '@/components/ui/Modal'
import { DataTable, type ColumnDef } from '@/components/data/DataTable'
import { swrFetcher, authFetch } from '@/lib/api/apiClient'
import { InviteModal } from '@/components/settings/InviteModal'
import {
  ROLE_LABELS,
  formatLastActive,
  roleBadgeVariant,
} from '@/lib/settings/roleDefinitions'
import type { TeamOverviewDTO, TeamMemberDTO } from '@/lib/settings/teamService'

const ASSIGNABLE_ROLES: UserRole[] = [
  'OWNER',
  'CEO',
  'MANAGER',
  'FINANCE_OFFICER',
  'SALES_OFFICER',
  'EMPLOYEE',
]

export function TeamPageClient() {
  const { data, mutate, isLoading } = useSWR<TeamOverviewDTO>('/settings/team', swrFetcher)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<TeamMemberDTO | null>(null)
  const [selected, setSelected] = useState<TeamMemberDTO[]>([])
  const [bulkRole, setBulkRole] = useState<UserRole>('EMPLOYEE')
  const [bulkOpen, setBulkOpen] = useState(false)

  const stats = data?.stats
  const members = data?.members ?? []
  const invitations = data?.invitations ?? []

  const changeRole = useCallback(
    async (userId: string, role: UserRole) => {
      const res = await authFetch(`/api/settings/team/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role }),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error?.message ?? 'Failed to update role')
        return
      }
      toast.success('Role updated')
      mutate()
    },
    [mutate],
  )

  const toggleStatus = useCallback(
    async (member: TeamMemberDTO) => {
      const res = await authFetch(`/api/settings/team/${member.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: !member.isActive }),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error?.message ?? 'Failed to update status')
        return
      }
      toast.success(member.isActive ? 'Member suspended' : 'Member reactivated')
      await mutate()
    },
    [mutate],
  )

  const removeMember = useCallback(async () => {
    if (!removeTarget) return
    const res = await authFetch(`/api/settings/team/${removeTarget.id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    const json = await res.json()
    if (!json.success) {
      toast.error(json.error?.message ?? 'Failed to remove member')
      throw new Error(json.error?.message)
    }
    toast.success('Member removed')
    setRemoveTarget(null)
    await mutate()
  }, [removeTarget, mutate])

  const resendInvite = useCallback(
    async (invitationId: string) => {
      const res = await authFetch('/api/tenants/invitations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ invitationId }),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error?.message ?? 'Failed to resend')
        return
      }
      toast.success('Invitation resent')
      mutate()
    },
    [mutate],
  )

  const revokeInvite = useCallback(
    async (invitationId: string) => {
      const res = await authFetch(`/api/tenants/invitations?id=${invitationId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error?.message ?? 'Failed to revoke')
        return
      }
      toast.success('Invitation revoked')
      mutate()
    },
    [mutate],
  )

  const bulkChangeRole = useCallback(async () => {
    for (const m of selected) {
      await changeRole(m.id, bulkRole)
    }
    setBulkOpen(false)
    setSelected([])
  }, [selected, bulkRole, changeRole])

  const bulkRemove = useCallback(async () => {
    for (const m of selected) {
      const res = await authFetch(`/api/settings/team/${m.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(`${m.fullName}: ${json.error?.message ?? 'Failed'}`)
      }
    }
    toast.success('Bulk remove completed')
    setSelected([])
    mutate()
  }, [selected, mutate])

  const columns = useMemo<ColumnDef<TeamMemberDTO>[]>(
    () => [
      {
        id: 'member',
        header: 'Member',
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <Avatar src={row.avatarUrl ?? undefined} name={row.fullName} size="sm" />
            <div>
              <p className="font-medium">{row.fullName}</p>
              {row.customRoleName && (
                <p className="text-xs text-slate-500">{row.customRoleName}</p>
              )}
            </div>
          </div>
        ),
      },
      {
        id: 'email',
        header: 'Email',
        accessorKey: 'email',
      },
      {
        id: 'role',
        header: 'Role',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Badge variant={roleBadgeVariant(row.role)}>{ROLE_LABELS[row.role]}</Badge>
            <select
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
              value={row.role}
              onChange={(e) => changeRole(row.id, e.target.value as UserRole)}
              onClick={(e) => e.stopPropagation()}
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
        ),
      },
      {
        id: 'lastActive',
        header: 'Last active',
        cell: ({ row }) => (
          <span className="text-sm text-slate-500">{formatLastActive(row.lastLoginAt)}</span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge
            variant={
              row.status === 'Active' ? 'success' : row.status === 'Suspended' ? 'warning' : 'outline'
            }
          >
            {row.status}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        type: 'actions',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation()
                void toggleStatus(row)
              }}
            >
              {row.isActive ? 'Suspend' : 'Unsuspend'}
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={(e) => {
                e.stopPropagation()
                setRemoveTarget(row)
              }}
            >
              Remove
            </Button>
          </div>
        ),
      },
    ],
    [changeRole, toggleStatus],
  )

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Team"
        subtitle="Members, invitations, and access control"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Settings', href: '/settings' },
          { label: 'Team' },
        ]}
        actions={
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Invite member
          </Button>
        }
      />

      <div className="flex-1 space-y-6 overflow-auto p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardBody className="flex items-center gap-4 p-5">
              <div className="rounded-lg bg-indigo-50 p-3 dark:bg-indigo-950/40">
                <Users className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total members</p>
                <p className="font-display text-2xl font-semibold">{stats?.totalMembers ?? '—'}</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-4 p-5">
              <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-950/40">
                <Mail className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Pending invitations</p>
                <p className="font-display text-2xl font-semibold">
                  {stats?.pendingInvitations ?? '—'}
                </p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-4 p-5">
              <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/40">
                <Clock className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Seats used</p>
                <p className="font-display text-2xl font-semibold">
                  {stats ? `${stats.seatsUsed} / ${stats.seatLimit}` : '—'}
                </p>
              </div>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardBody className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <h2 className="font-display text-lg font-semibold">Members</h2>
              {selected.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-slate-500">{selected.length} selected</span>
                  <Button size="sm" variant="secondary" onClick={() => setBulkOpen(true)}>
                    Change role
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => void bulkRemove()}>
                    Remove
                  </Button>
                </div>
              )}
            </div>
            <DataTable
              columns={columns}
              data={members}
              loading={isLoading}
              keyField="id"
              selectable
              onSelectionChange={setSelected}
              emptyTitle="No team members"
              emptyDescription="Invite colleagues to collaborate in this workspace."
            />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-6">
            <h2 className="font-display text-lg font-semibold">Pending invitations</h2>
            {invitations.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No pending invitations.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left dark:border-slate-800">
                      <th className="py-2 pr-4 font-medium">Email</th>
                      <th className="py-2 pr-4 font-medium">Role</th>
                      <th className="py-2 pr-4 font-medium">Sent</th>
                      <th className="py-2 pr-4 font-medium">Expires</th>
                      <th className="py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.map((inv) => (
                      <tr key={inv.id} className="border-b border-slate-100 dark:border-slate-800/60">
                        <td className="py-3 pr-4">{inv.email}</td>
                        <td className="py-3 pr-4">
                          <Badge variant="outline">{inv.roleLabel}</Badge>
                        </td>
                        <td className="py-3 pr-4 text-slate-500">
                          {new Date(inv.sentAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 pr-4 text-slate-500">
                          {new Date(inv.expiresAt).toLocaleDateString()}
                        </td>
                        <td className="py-3">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => void resendInvite(inv.id)}
                            >
                              <RotateCcw className="mr-1 h-3 w-3" />
                              Resend
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => void revokeInvite(inv.id)}
                            >
                              Revoke
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <InviteModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onSuccess={() => mutate()}
        seatsRemaining={
          stats ? Math.max(0, stats.seatLimit - stats.seatsUsed) : undefined
        }
      />

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
        title="Remove team member?"
        description={
          removeTarget
            ? `${removeTarget.fullName} will lose access to this workspace.`
            : undefined
        }
        confirmLabel="Remove"
        onConfirm={removeMember}
      />

      <ModalRoot open={bulkOpen} onOpenChange={setBulkOpen}>
        <ModalContent size="sm">
          <ModalHeader>
            <ModalTitle>Bulk change role</ModalTitle>
          </ModalHeader>
          <ModalBody className="space-y-4">
            <p className="text-sm text-slate-500">
              Apply a new role to {selected.length} selected member(s).
            </p>
            <select
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              value={bulkRole}
              onChange={(e) => setBulkRole(e.target.value as UserRole)}
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void bulkChangeRole()}>Apply</Button>
          </ModalFooter>
        </ModalContent>
      </ModalRoot>
    </div>
  )
}
