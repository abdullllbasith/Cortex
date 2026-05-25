import { prisma } from '@/lib/db/prisma'

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export class EmailAlreadyRegisteredError extends Error {
  readonly code = 'EMAIL_ALREADY_REGISTERED'

  constructor(email?: string) {
    super(
      email
        ? `An account already exists for ${email}. Sign in instead or use a different email.`
        : 'This email is already registered.',
    )
    this.name = 'EmailAlreadyRegisteredError'
  }
}

export async function isEmailRegistered(
  email: string,
  options?: { excludeUserId?: string },
): Promise<boolean> {
  const normalized = normalizeEmail(email)
  if (!normalized) return false

  const existing = await prisma.user.findFirst({
    where: { email: normalized },
    select: { id: true },
  })

  if (!existing) return false
  if (options?.excludeUserId && existing.id === options.excludeUserId) return false
  return true
}

export async function assertEmailAvailable(
  email: string,
  options?: { excludeUserId?: string },
): Promise<void> {
  if (await isEmailRegistered(email, options)) {
    throw new EmailAlreadyRegisteredError(normalizeEmail(email))
  }
}
