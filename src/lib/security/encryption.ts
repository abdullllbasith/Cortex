import { createHash, createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import bcrypt from 'bcrypt'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16
const BCRYPT_ROUNDS = 12

function deriveTenantKey(tenantId: string): Buffer {
  const master = process.env.ENCRYPTION_MASTER_KEY ?? process.env.JWT_SECRET ?? 'dev-encryption-key-change-me'
  return scryptSync(`${master}:${tenantId}`, 'saios-salt', 32)
}

/** AES-256-GCM field encryption with tenant-specific derived key */
export function encryptField(plaintext: string, tenantId: string): string {
  const key = deriveTenantKey(tenantId)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decryptField(ciphertext: string, tenantId: string): string {
  const key = deriveTenantKey(tenantId)
  const buf = Buffer.from(ciphertext, 'base64')
  const iv = buf.subarray(0, IV_LENGTH)
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const data = buf.subarray(IV_LENGTH + TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateSecureToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
