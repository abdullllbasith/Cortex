'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { LayoutGrid, List, Plus, Search, UserSquare2 } from 'lucide-react'
import {
  PageHeader,
  Badge,
  Card,
  CardBody,
  Avatar,
  Button,
  Input,
  SelectField,
  ModalRoot,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
  Checkbox,
  toast,
} from '@/components/ui'
import { DataTable, type ColumnDef } from '@/components/data/DataTable'
import { swrFetcher, apiClient } from '@/lib/api/apiClient'
import { ResponsiveContainer } from '@/components/layout/ResponsiveContainer'

type EmployeeStatus = 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED' | 'PROBATION'
type ViewMode = 'table' | 'cards'

interface EmployeeListItem extends Record<string, unknown> {
  id: string
  employeeNumber: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  phone: string | null
  photo: string | null
  status: EmployeeStatus
  type: string
  departmentName: string | null
  designationTitle: string | null
  joinDate: string
}

interface EmployeesResponse {
  items: EmployeeListItem[]
}

interface DepartmentOption {
  id: string
  name: string
  code: string
}

interface DesignationOption {
  id: string
  title: string
  departmentId: string | null
}

const STATUS_VARIANT: Record<EmployeeStatus, 'success' | 'warning' | 'danger' | 'info'> = {
  ACTIVE: 'success',
  ON_LEAVE: 'info',
  PROBATION: 'warning',
  TERMINATED: 'danger',
}

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_LEAVE', label: 'On leave' },
  { value: 'PROBATION', label: 'Probation' },
  { value: 'TERMINATED', label: 'Terminated' },
]

type FormStep = 1 | 2 | 3

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  gender: '',
  nationalId: '',
  departmentId: '',
  designationId: '',
  managerId: '',
  type: 'FULL_TIME',
  joinDate: new Date().toISOString().slice(0, 10),
  emergencyName: '',
  emergencyPhone: '',
  emergencyRelation: '',
  createUserAccount: false,
}

function EmployeeCard({ employee }: { employee: EmployeeListItem }) {
  return (
    <Link href={`/hr/employees/${employee.id}`}>
      <Card className="border-slate-200 transition-shadow hover:shadow-md">
        <CardBody className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <Avatar name={employee.fullName} src={employee.photo ?? undefined} size="sm" />
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{employee.fullName}</p>
                <p className="text-xs text-slate-500">{employee.employeeNumber}</p>
              </div>
            </div>
            <Badge variant={STATUS_VARIANT[employee.status]} size="sm">{employee.status.replace('_', ' ')}</Badge>
          </div>
          <div className="space-y-1 text-xs text-slate-500">
            {employee.designationTitle && <p>{employee.designationTitle}</p>}
            {employee.departmentName && <p>{employee.departmentName}</p>}
            <p>{employee.email}</p>
          </div>
        </CardBody>
      </Card>
    </Link>
  )
}

export function EmployeesPageClient() {
  const [view, setView] = useState<ViewMode>('cards')
  const [search, setSearch] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [status, setStatus] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [step, setStep] = useState<FormStep>(1)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  const queryKey = useMemo(() => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (departmentId) params.set('departmentId', departmentId)
    if (status) params.set('status', status)
    const qs = params.toString()
    return `/hr/employees${qs ? `?${qs}` : ''}`
  }, [search, departmentId, status])

  const { data, isLoading, mutate } = useSWR<EmployeesResponse>(queryKey, swrFetcher)
  const { data: departments } = useSWR<DepartmentOption[]>('/hr/departments', swrFetcher)
  const { data: designations } = useSWR<DesignationOption[]>('/hr/designations', swrFetcher)
  const { data: managersData } = useSWR<EmployeesResponse>('/hr/employees?status=ACTIVE&limit=100', swrFetcher)

  const items = data?.items ?? []
  const managers = managersData?.items ?? []

  const columns: ColumnDef<EmployeeListItem>[] = useMemo(
    () => [
      {
        id: 'name',
        header: 'Employee',
        cell: ({ row }) => (
          <Link href={`/hr/employees/${row.id}`} className="flex items-center gap-2 hover:text-indigo-600">
            <Avatar name={row.fullName} src={row.photo ?? undefined} size="sm" />
            <div>
              <p className="font-medium">{row.fullName}</p>
              <p className="text-xs text-slate-500">{row.employeeNumber}</p>
            </div>
          </Link>
        ),
      },
      { id: 'department', header: 'Department', cell: ({ row }) => row.departmentName ?? '—' },
      { id: 'designation', header: 'Designation', cell: ({ row }) => row.designationTitle ?? '—' },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.status]} size="sm">{row.status.replace('_', ' ')}</Badge>,
      },
      { id: 'email', header: 'Email', cell: ({ row }) => row.email },
    ],
    [],
  )

  async function handleCreate() {
    setSubmitting(true)
    try {
      await apiClient.post('/hr/employees', {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || null,
        dateOfBirth: form.dateOfBirth || null,
        gender: form.gender || null,
        nationalId: form.nationalId || null,
        departmentId: form.departmentId || null,
        designationId: form.designationId || null,
        managerId: form.managerId || null,
        type: form.type,
        joinDate: form.joinDate,
        emergencyContact: {
          name: form.emergencyName,
          phone: form.emergencyPhone,
          relation: form.emergencyRelation,
        },
        createUserAccount: form.createUserAccount,
      })
      toast.success('Employee created')
      setShowAdd(false)
      setForm(EMPTY_FORM)
      setStep(1)
      await mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create employee')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Employees"
        subtitle="Manage your workforce directory"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'HR', href: '/hr/employees' },
          { label: 'Employees' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/hr/leave">
              <Button variant="secondary" size="sm">Leave calendar</Button>
            </Link>
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Add employee
            </Button>
          </div>
        }
      />

      <ResponsiveContainer className="flex-1 space-y-4 py-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search by name, email, or employee number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <SelectField
            label=""
            value={departmentId}
            onValueChange={setDepartmentId}
            data={[
              { value: '', label: 'All departments' },
              ...(departments ?? []).map((d) => ({ value: d.id, label: d.name })),
            ]}
            className="w-44"
          />
          <SelectField
            label=""
            value={status}
            onValueChange={setStatus}
            data={STATUS_OPTIONS}
            className="w-40"
          />
          <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
            <Button
              variant={view === 'cards' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setView('cards')}
              aria-label="Card view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={view === 'table' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setView('table')}
              aria-label="Table view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="h-32 animate-pulse bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardBody className="flex flex-col items-center py-12 text-center">
              <UserSquare2 className="mb-3 h-10 w-10 text-slate-300" />
              <p className="font-medium text-slate-700 dark:text-slate-300">No employees yet</p>
              <p className="mt-1 text-sm text-slate-500">Add your first team member to get started.</p>
              <Button className="mt-4" size="sm" onClick={() => setShowAdd(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> Add employee
              </Button>
            </CardBody>
          </Card>
        ) : view === 'cards' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((emp) => (
              <EmployeeCard key={emp.id} employee={emp} />
            ))}
          </div>
        ) : (
          <DataTable columns={columns} data={items} />
        )}
      </ResponsiveContainer>

      <ModalRoot open={showAdd} onOpenChange={setShowAdd}>
        <ModalContent size="lg">
          <ModalHeader>
            <ModalTitle>Add employee — Step {step} of 3</ModalTitle>
          </ModalHeader>
          <ModalBody className="space-y-4">
            {step === 1 && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
                  <Input label="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
                </div>
                <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Date of birth" type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
                  <Input label="Gender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} />
                </div>
                <Input label="National ID" value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} />
              </>
            )}
            {step === 2 && (
              <>
                <SelectField
                  label="Department"
                  value={form.departmentId}
                  onValueChange={(v) => setForm({ ...form, departmentId: v })}
                  data={[
                    { value: '', label: 'Select department' },
                    ...(departments ?? []).map((d) => ({ value: d.id, label: d.name })),
                  ]}
                />
                <SelectField
                  label="Designation"
                  value={form.designationId}
                  onValueChange={(v) => setForm({ ...form, designationId: v })}
                  data={[
                    { value: '', label: 'Select designation' },
                    ...(designations ?? [])
                      .filter((d) => !form.departmentId || d.departmentId === form.departmentId)
                      .map((d) => ({ value: d.id, label: d.title })),
                  ]}
                />
                <SelectField
                  label="Manager"
                  value={form.managerId}
                  onValueChange={(v) => setForm({ ...form, managerId: v })}
                  data={[
                    { value: '', label: 'No manager' },
                    ...managers.map((m) => ({ value: m.id, label: m.fullName })),
                  ]}
                />
                <SelectField
                  label="Employment type"
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v })}
                  data={[
                    { value: 'FULL_TIME', label: 'Full time' },
                    { value: 'PART_TIME', label: 'Part time' },
                    { value: 'CONTRACT', label: 'Contract' },
                    { value: 'INTERN', label: 'Intern' },
                  ]}
                />
                <Input label="Join date" type="date" value={form.joinDate} onChange={(e) => setForm({ ...form, joinDate: e.target.value })} />
              </>
            )}
            {step === 3 && (
              <>
                <Input label="Emergency contact name" value={form.emergencyName} onChange={(e) => setForm({ ...form, emergencyName: e.target.value })} />
                <Input label="Emergency contact phone" value={form.emergencyPhone} onChange={(e) => setForm({ ...form, emergencyPhone: e.target.value })} />
                <Input label="Relationship" value={form.emergencyRelation} onChange={(e) => setForm({ ...form, emergencyRelation: e.target.value })} />
                <Checkbox
                  label="Create linked user account"
                  checked={form.createUserAccount}
                  onCheckedChange={(v) => setForm({ ...form, createUserAccount: v === true })}
                />
              </>
            )}
          </ModalBody>
          <ModalFooter>
            {step > 1 && (
              <Button variant="secondary" onClick={() => setStep((s) => (s - 1) as FormStep)}>
                Back
              </Button>
            )}
            {step < 3 ? (
              <Button
                onClick={() => setStep((s) => (s + 1) as FormStep)}
                disabled={step === 1 && (!form.firstName || !form.lastName || !form.email)}
              >
                Next
              </Button>
            ) : (
              <Button onClick={handleCreate} loading={submitting}>
                Create employee
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </ModalRoot>
    </div>
  )
}
