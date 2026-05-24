import { ApiError, formatApiErrorMessage } from './types'
import { getSessionSnapshot, useSessionStore } from '@/store/sessionStore'
import { getAdminSessionSnapshot, useAdminSessionStore } from '@/store/adminSessionStore'

/* ─────────────────────────────────────────────────────────────────────────────
   Configuration
   ───────────────────────────────────────────────────────────────────────────── */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api'

const MAX_5XX_RETRIES = 2
const BASE_BACKOFF_MS = 500

/* ─────────────────────────────────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────────────────────────────────── */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildUrl(path: string, params?: Record<string, unknown>): string {
  if (path.startsWith('http')) {
    if (!params) return path
    const search = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') search.set(k, String(v))
    }
    const qs = search.toString()
    return qs ? `${path}${path.includes('?') ? '&' : '?'}${qs}` : path
  }

  const [pathname, embeddedQs] = path.split('?')
  let normalized = pathname.replace(/^\//, '')
  const base = BASE_URL.replace(/\/$/, '')

  // Prevent /api/api/... when callers pass paths like /api/analytics/executive
  if (base.endsWith('/api') && normalized.startsWith('api/')) {
    normalized = normalized.slice(4)
  }

  let url = `${base}/${normalized}`
  const search = new URLSearchParams()
  if (embeddedQs) {
    new URLSearchParams(embeddedQs).forEach((v, k) => search.set(k, v))
  }
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') search.set(k, String(v))
    }
  }
  const qs = search.toString()
  return qs ? `${url}?${qs}` : url
}

async function parseErrorResponse(res: Response): Promise<ApiError> {
  let body: Record<string, unknown> = {}
  try {
    body = await res.json()
  } catch {
    /* non-JSON error body */
  }

  const nestedError =
    body.error && typeof body.error === 'object' && !Array.isArray(body.error)
      ? (body.error as { message?: string; code?: string; details?: Record<string, unknown> })
      : null

  const messageCandidates = [
    nestedError?.message,
    body.message,
    typeof body.error === 'string' ? body.error : body.error,
  ]

  let message = res.statusText || 'Request failed'
  for (const candidate of messageCandidates) {
    if (candidate == null) continue
    const formatted = formatApiErrorMessage(candidate)
    if (formatted !== 'Request failed') {
      message = formatted
      break
    }
  }

  const code =
    (typeof nestedError?.code === 'string' ? nestedError.code : undefined) ??
    (typeof body.code === 'string' ? body.code : undefined) ??
    `HTTP_${res.status}`

  return new ApiError(
    formatApiErrorMessage(message),
    res.status,
    code,
    (nestedError?.details ?? body.details) as Record<string, unknown> | undefined,
  )
}

function unwrapApiEnvelope<T>(json: unknown): T {
  if (
    json &&
    typeof json === 'object' &&
    'success' in json &&
    (json as { success: boolean }).success === true &&
    'data' in json
  ) {
    const envelope = json as { data: unknown; meta?: Record<string, unknown> }
    const meta = envelope.meta
    if (meta && Array.isArray(envelope.data) && typeof meta.total === 'number') {
      return {
        data: envelope.data,
        total: meta.total,
        page: meta.page ?? 1,
        limit: meta.limit ?? envelope.data.length,
      } as T
    }
    return envelope.data as T
  }
  return json as T
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    })
    if (!res.ok) return null
    const json = await res.json()
    const accessToken = json.data?.accessToken as string | undefined
    if (accessToken) {
      useSessionStore.getState().setTokens(accessToken)
      return accessToken
    }
  } catch {
    /* ignore */
  }
  return null
}

function redirectToLogin() {
  if (typeof window !== 'undefined') {
    useSessionStore.getState().clearSession()
    window.location.href = '/login'
  }
}

function redirectToAdminLogin() {
  if (typeof window !== 'undefined') {
    useAdminSessionStore.getState().clearSession()
    window.location.href = '/admin/login'
  }
}

function isAdminApiPath(path: string): boolean {
  const normalized = path.replace(/^\//, '')
  return normalized.startsWith('admin/') || normalized.startsWith('api/admin/')
}

/* ─────────────────────────────────────────────────────────────────────────────
   Request options
   ───────────────────────────────────────────────────────────────────────────── */

export interface RequestOptions {
  params?: Record<string, unknown>
  signal?: AbortSignal
  headers?: Record<string, string>
  /** Skip auth header (public endpoints) */
  public?: boolean
  /** Retry count override for 5xx */
  retries?: number
}

export interface UploadOptions extends RequestOptions {
  onProgress?: (pct: number) => void
}

/* ─────────────────────────────────────────────────────────────────────────────
   Core request
   ───────────────────────────────────────────────────────────────────────────── */

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
  retried401 = false,
  retry5xx = 0,
): Promise<T> {
  const { params, signal, headers: extraHeaders, public: isPublic, retries } = options
  const url = buildUrl(path, params)

  const session = getSessionSnapshot()
  const adminSession = getAdminSessionSnapshot()
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...extraHeaders,
  }

  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  if (!isPublic) {
    if (isAdminApiPath(path) && adminSession.accessToken) {
      headers['Authorization'] = `Bearer ${adminSession.accessToken}`
    } else if (session.accessToken) {
      headers['Authorization'] = `Bearer ${session.accessToken}`
    }
  }

  if (session.tenant?.id) {
    headers['x-tenant-id'] = session.tenant.id
  } else if (process.env.NODE_ENV === 'development') {
    headers['x-tenant-id'] = 'dev-tenant-1'
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  })

  /* 401 — refresh token → retry once → redirect */
  if (res.status === 401 && !retried401 && !isPublic) {
    if (isAdminApiPath(path)) {
      redirectToAdminLogin()
      throw new ApiError('Admin session expired', 401, 'UNAUTHORIZED')
    }
    const newToken = await refreshAccessToken()
    if (newToken) return request<T>(method, path, body, options, true, retry5xx)
    redirectToLogin()
    throw new ApiError('Session expired', 401, 'UNAUTHORIZED')
  }

  /* 429 — wait Retry-After → retry once */
  if (res.status === 429) {
    const retryAfter = res.headers.get('Retry-After')
    const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 2000
    await sleep(waitMs)
    return request<T>(method, path, body, options, retried401, retry5xx)
  }

  /* 5xx — exponential backoff retry */
  if (res.status >= 500) {
    const maxRetries = retries ?? MAX_5XX_RETRIES
    if (retry5xx < maxRetries) {
      const delay = BASE_BACKOFF_MS * Math.pow(2, retry5xx)
      await sleep(delay)
      return request<T>(method, path, body, options, retried401, retry5xx + 1)
    }
  }

  if (!res.ok) throw await parseErrorResponse(res)

  if (res.status === 204) return undefined as T

  const json = await res.json()
  return unwrapApiEnvelope<T>(json)
}

/* ─────────────────────────────────────────────────────────────────────────────
   Multipart upload with progress
   ───────────────────────────────────────────────────────────────────────────── */

async function upload<T>(
  path: string,
  formData: FormData,
  options: UploadOptions = {},
): Promise<T> {
  const { onProgress, ...rest } = options

  /* Use XMLHttpRequest for upload progress when callback provided */
  if (onProgress && typeof XMLHttpRequest !== 'undefined') {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const url = buildUrl(path, rest.params)
      const session = getSessionSnapshot()

      xhr.open('POST', url)
      xhr.setRequestHeader('Accept', 'application/json')
      if (session.accessToken) xhr.setRequestHeader('Authorization', `Bearer ${session.accessToken}`)
      if (session.tenant?.id) xhr.setRequestHeader('x-tenant-id', session.tenant.id)

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText) as T) }
          catch { resolve(undefined as T) }
        } else {
          reject(new ApiError(xhr.statusText, xhr.status))
        }
      }

      xhr.onerror = () => reject(new ApiError('Upload failed', 0, 'UPLOAD_ERROR'))
      if (rest.signal) rest.signal.addEventListener('abort', () => xhr.abort())
      xhr.send(formData)
    })
  }

  return request<T>('POST', path, formData, rest)
}

/* ─────────────────────────────────────────────────────────────────────────────
   Public API client
   ───────────────────────────────────────────────────────────────────────────── */

export const apiClient = {
  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>('GET', path, undefined, options)
  },

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>('POST', path, body, options)
  },

  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>('PUT', path, body, options)
  },

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>('PATCH', path, body, options)
  },

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>('DELETE', path, undefined, options)
  },

  upload,
}

/** SWR-compatible fetcher — uses apiClient (envelope already unwrapped) */
export async function swrFetcher<T>(key: string | [string, ...unknown[]]): Promise<T> {
  const path = Array.isArray(key) ? (key[0] as string) : key
  return apiClient.get<T>(path)
}

/** Normalize list API responses — plain arrays or `{ data: T[] }` paginated envelopes */
export function normalizeApiList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value
  if (
    value &&
    typeof value === 'object' &&
    'data' in value &&
    Array.isArray((value as { data: unknown }).data)
  ) {
    return (value as { data: T[] }).data
  }
  return []
}
