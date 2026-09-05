'use client'

import { useCallback, useMemo, useState } from 'react'
import useSWR from 'swr'
import { Plus, Trash2, Save, Lock, ShieldCheck } from 'lucide-react'
import type { UserRole } from '@prisma/client'
import {
  PageHeader,
  Button,
  Card,
  CardBody,
  Badge,
  Input,
  ModalRoot,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalTitle,
  ConfirmDialog,
  toast,
} from '@/components/ui'
import { swrFetcher, authFetch } from '@/lib/api/apiClient'
import { ROLE_LABELS } from '@/lib/settings/roleDefinitions'
import { BUILTIN_ROLES } from '@/lib/settings/permissionCategories'
import type { CustomRoleDTO } from '@/lib/settings/rolesService'

interface RolesPageData {
  plan: string
  canCustomRoles: boolean
  categories: string[]
  builtinRoles: UserRole[]
  matrix: Record<UserRole, Record<string, boolean>>
  roleUsage: Array<{ role: UserRole; label: string; memberCount: number }>
  customRoles: CustomRoleDTO[]
}

function PermissionMatrix({
  categories,
  roles,
  matrix,
  roleLabels,
  lockedRoles = [],
  onToggle,
  dirtyRoles,
  onSave,
  savingRole,
}: {
  categories: string[]
  roles: string[]
  matrix: Record<string, Record<string, boolean>>
  roleLabels?: Record<string, string>
  lockedRoles?: string[]
  onToggle: (role: string, category: string, checked: boolean) => void
  dirtyRoles?: Set<string>
  onSave?: (role: string) => void
  savingRole?: string | null
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800">
            <th className="sticky left-0 bg-white px-4 py-3 text-left font-medium dark:bg-slate-950">
              Category
            </th>
            {roles.map((role) => (
              <th key={role} className="min-w-[100px] px-3 py-3 text-center font-medium">
                <div className="flex flex-col items-center gap-1">
                  <span>{roleLabels?.[role] ?? ROLE_LABELS[role as UserRole] ?? role}</span>
                  {dirtyRoles?.has(role) && onSave && (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={savingRole === role}
                      onClick={() => onSave(role)}
                    >
                      <Save className="mr-1 h-3 w-3" />
                      Save
                    </Button>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map((cat) => (
            <tr key={cat} className="border-b border-slate-100 dark:border-slate-800/60">
              <td className="sticky left-0 bg-white px-4 py-2 font-medium dark:bg-slate-950">{cat}</td>
              {roles.map((role) => {
                const locked = lockedRoles.includes(role)
                const checked = matrix[role]?.[cat] ?? false
                return (
                  <td key={role} className="px-3 py-2 text-center">
                    {locked ? (
                      <Lock className="mx-auto h-4 w-4 text-slate-400" aria-label="Locked" />
                    ) : (
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => onToggle(role, cat, e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function RolesPageClient() {
  const { data, mutate, isLoading } = useSWR<RolesPageData>('/settings/roles', swrFetcher)
  const [localMatrix, setLocalMatrix] = useState<Record<string, Record<string, boolean>>>({})
  const [dirtyRoles, setDirtyRoles] = useState<Set<string>>(new Set())
  const [savingRole, setSavingRole] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [inheritFrom, setInheritFrom] = useState<UserRole>('EMPLOYEE')
  const [deleteTarget, setDeleteTarget] = useState<CustomRoleDTO | null>(null)

  const categories = data?.categories ?? []
  const builtinRoles = data?.builtinRoles ?? BUILTIN_ROLES
  const roleUsage = data?.roleUsage ?? []
  const customRoles = data?.customRoles ?? []
  const canCustomRoles = data?.canCustomRoles ?? false

  const serverMatrix = data?.matrix ?? ({} as Record<UserRole, Record<string, boolean>>)
  const displayMatrix = useMemo(() => {
    const merged: Record<string, Record<string, boolean>> = {}
    for (const role of builtinRoles) {
      merged[role] = { ...serverMatrix[role], ...localMatrix[role] }
    }
    for (const cr of customRoles) {
      merged[cr.id] = localMatrix[cr.id] ?? cr.categoryMatrix
    }
    return merged
  }, [serverMatrix, localMatrix, builtinRoles, customRoles])

  const toggleCell = useCallback((role: string, category: string, checked: boolean) => {
    setLocalMatrix((prev) => ({
      ...prev,
      [role]: { ...(prev[role] ?? displayMatrix[role]), [category]: checked },
    }))
    setDirtyRoles((prev) => new Set(prev).add(role))
  }, [displayMatrix])

  const saveRole = useCallback(
    async (roleId: string) => {
      const categoriesPayload = displayMatrix[roleId]
      if (!categoriesPayload) return

      setSavingRole(roleId)
      const prevMatrix = { ...localMatrix[roleId] }
      const prevDirty = new Set(dirtyRoles)

      try {
        const res = await authFetch(`/api/settings/roles/${roleId}/permissions`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ categories: categoriesPayload }),
        })
        const json = await res.json()
        if (!json.success) {
          toast.error(json.error?.message ?? 'Failed to save')
          return
        }
        toast.success('Permissions saved')
        setDirtyRoles((prev) => {
          const next = new Set(prev)
          next.delete(roleId)
          return next
        })
        setLocalMatrix((prev) => {
          const next = { ...prev }
          delete next[roleId]
          return next
        })
        mutate()
      } catch {
        setLocalMatrix((prev) => ({ ...prev, [roleId]: prevMatrix }))
        setDirtyRoles(prevDirty)
        toast.error('Failed to save permissions')
      } finally {
        setSavingRole(null)
      }
    },
    [displayMatrix, localMatrix, dirtyRoles, mutate],
  )

  const createCustomRole = async () => {
    if (!newName.trim()) {
      toast.error('Role name is required')
      return
    }
    const res = await authFetch('/api/settings/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        inheritFrom,
      }),
    })
    const json = await res.json()
    if (!json.success) {
      toast.error(json.error?.message ?? 'Failed to create role')
      return
    }
    toast.success('Custom role created')
    setCreateOpen(false)
    setNewName('')
    setNewDescription('')
    mutate()
  }

  const deleteCustomRole = async () => {
    if (!deleteTarget) return
    const res = await authFetch(`/api/settings/roles/${deleteTarget.id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    const json = await res.json()
    if (!json.success) {
      toast.error(json.error?.message ?? 'Failed to delete role')
      throw new Error(json.error?.message)
    }
    toast.success('Custom role deleted')
    setDeleteTarget(null)
    mutate()
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Roles & Permissions"
        subtitle="Define roles and granular permission sets"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Settings', href: '/settings' },
          { label: 'Roles' },
        ]}
      />

      <div className="flex-1 space-y-6 overflow-auto p-6">
        <Card>
          <CardBody className="p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold">Permission matrix</h2>
                <p className="text-sm text-slate-500">
                  Owner permissions are locked. Save changes per role when ready.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {roleUsage.map((r) => (
                  <Badge key={r.role} variant="outline">
                    {r.label} ({r.memberCount} members)
                  </Badge>
                ))}
              </div>
            </div>
            {isLoading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : (
              <PermissionMatrix
                categories={categories}
                roles={builtinRoles}
                matrix={displayMatrix}
                lockedRoles={['OWNER']}
                onToggle={toggleCell}
                dirtyRoles={dirtyRoles}
                onSave={saveRole}
                savingRole={savingRole}
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold">Custom roles</h2>
                <p className="text-sm text-slate-500">
                  {canCustomRoles
                    ? 'Create roles tailored to your organization.'
                    : 'Upgrade to Professional to create custom roles.'}
                </p>
              </div>
              {canCustomRoles && (
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create custom role
                </Button>
              )}
            </div>

            {customRoles.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <ShieldCheck className="h-4 w-4" />
                No custom roles yet
              </div>
            ) : (
              <div className="space-y-6">
                {customRoles.map((cr) => (
                  <div key={cr.id} className="rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                      <div>
                        <p className="font-medium">{cr.name}</p>
                        {cr.description && (
                          <p className="text-xs text-slate-500">{cr.description}</p>
                        )}
                        <p className="text-xs text-slate-400">{cr.memberCount} members</p>
                      </div>
                      <div className="flex gap-2">
                        {dirtyRoles.has(cr.id) && (
                          <Button
                            size="sm"
                            loading={savingRole === cr.id}
                            onClick={() => void saveRole(cr.id)}
                          >
                            Save permissions
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setDeleteTarget(cr)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <PermissionMatrix
                      categories={categories}
                      roles={[cr.id]}
                      matrix={displayMatrix}
                      roleLabels={{ [cr.id]: cr.name }}
                      onToggle={toggleCell}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <ModalRoot open={createOpen} onOpenChange={setCreateOpen}>
        <ModalContent size="md">
          <ModalHeader>
            <ModalTitle>Create custom role</ModalTitle>
          </ModalHeader>
          <ModalBody className="space-y-4">
            <Input
              label="Role name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Regional Manager"
            />
            <div>
              <label className="mb-2 block text-sm font-medium">Description</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Inherit from</label>
              <select
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={inheritFrom}
                onChange={(e) => setInheritFrom(e.target.value as UserRole)}
              >
                {builtinRoles.filter((r) => r !== 'OWNER').map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void createCustomRole()}>Create role</Button>
          </ModalFooter>
        </ModalContent>
      </ModalRoot>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete custom role?"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" will be permanently removed. Members must be reassigned first.`
            : undefined
        }
        confirmLabel="Delete"
        onConfirm={deleteCustomRole}
      />
    </div>
  )
}
