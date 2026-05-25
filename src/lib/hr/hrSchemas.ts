import { z } from 'zod'

export const employeeCreateSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email(),
  phone: z.string().max(30).optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  gender: z.string().max(20).optional().nullable(),
  nationalId: z.string().max(40).optional().nullable(),
  address: z.record(z.string(), z.unknown()).optional(),
  photo: z.string().url().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  designationId: z.string().optional().nullable(),
  managerId: z.string().optional().nullable(),
  type: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']).optional(),
  status: z.enum(['ACTIVE', 'ON_LEAVE', 'TERMINATED', 'PROBATION']).optional(),
  joinDate: z.string().optional(),
  confirmationDate: z.string().optional().nullable(),
  emergencyContact: z.record(z.string(), z.unknown()).optional(),
  bankDetails: z.record(z.string(), z.unknown()).optional().nullable(),
  userId: z.string().optional().nullable(),
  createUserAccount: z.boolean().optional(),
})

export const employeeUpdateSchema = employeeCreateSchema.partial()

export const employeeListQuerySchema = z.object({
  search: z.string().optional(),
  departmentId: z.string().optional(),
  status: z.enum(['ACTIVE', 'ON_LEAVE', 'TERMINATED', 'PROBATION']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
})

export const employeeTerminateSchema = z.object({
  terminationDate: z.string().optional(),
  terminationReason: z.string().min(1).max(2000),
})

export const departmentSchema = z.object({
  name: z.string().min(1).max(120),
  code: z.string().min(1).max(20),
  managerId: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
})

export const designationSchema = z.object({
  title: z.string().min(1).max(120),
  departmentId: z.string().optional().nullable(),
  level: z.enum(['INTERN', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'MANAGER', 'DIRECTOR', 'C_LEVEL']).optional(),
})

export const leaveTypeSchema = z.object({
  name: z.string().min(1).max(80),
  code: z.string().min(1).max(20),
  daysAllowed: z.number().min(0).max(365),
  carryForward: z.boolean().optional(),
  maxCarryForward: z.number().min(0).max(365).optional(),
  isPaid: z.boolean().optional(),
  requiresApproval: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export const leaveApplySchema = z.object({
  employeeId: z.string().optional(),
  leaveTypeId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().max(2000).optional().nullable(),
})

export const leaveRejectSchema = z.object({
  reason: z.string().min(1).max(2000),
})

export const leaveRequestListSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
  employeeId: z.string().optional(),
  month: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const attendanceCreateSchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().min(1),
  checkIn: z.string().optional().nullable(),
  checkOut: z.string().optional().nullable(),
  status: z.enum(['PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'HOLIDAY', 'WEEKEND']).optional(),
  source: z.enum(['MANUAL', 'MOBILE', 'WEB']).optional(),
  notes: z.string().max(500).optional().nullable(),
})

export const attendanceListSchema = z.object({
  employeeId: z.string().optional(),
  month: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
})

const salaryComponentSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['EARNING', 'DEDUCTION', 'BENEFIT']),
  calculationType: z.enum(['FIXED', 'PERCENTAGE_OF_BASIC']),
  value: z.number(),
  isTaxable: z.boolean().optional(),
})

export const payrollRunCreateSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
})

export const payrollRunListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
})

export const salaryStructureSchema = z.object({
  name: z.string().min(1).max(120),
  components: z.array(salaryComponentSchema).min(1),
})

export const employeeSalarySchema = z.object({
  employeeId: z.string().min(1),
  salaryStructureId: z.string().min(1),
  basicSalary: z.number().min(0),
  effectiveFrom: z.string().min(1),
})
