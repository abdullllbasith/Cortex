import { ApiError } from './types'
import { getSessionSnapshot, useSessionStore } from '@/store/sessionStore'

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
  const base = path.startsWith('http') ? path : `${BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
  if (!params) return base
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      search.set(k, String(v))
    }
  }
  const qs = search.toString()
  return qs ? `${base}?${qs}` : base
}

async function parseErrorResponse(res: Response): Promise<ApiError> {
  let body: Record<string, unknown> = {}
  try {
    body = await res.json()
  } catch {
    /* non-JSON error body */
  }

  const message =
    (body.message as string) ??
    (body.error as string) ??
    res.statusText ??
    'Request failed'

  return new ApiError(
    message,
    res.status,
    (body.code as string) ?? `HTTP_${res.status}`,
    body.details as Record<string, unknown> | undefined,
  )
}

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken } = getSessionSnapshot()
  if (!refreshToken) return null

  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })

    if (!res.ok) return null

    const data = await res.json() as { accessToken: string; refreshToken?: string }
    useSessionStore.getState().setTokens(data.accessToken, data.refreshToken)
    return data.accessToken
  } catch {
    return null
  }
}

function redirectToLogin() {
  if (typeof window !== 'undefined') {
    useSessionStore.getState().clearSession()
    window.location.href = '/login'
  }
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
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...extraHeaders,
  }

  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  if (!isPublic && session.accessToken) {
    headers['Authorization'] = `Bearer ${session.accessToken}`
  }

  if (session.tenant?.id) {
    headers['x-tenant-id'] = session.tenant.id
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  })

  /* 401 — refresh token → retry once → redirect */
  if (res.status === 401 && !retried401 && !isPublic) {
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

  return res.json() as Promise<T>
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

/** SWR-compatible fetcher */
export async function swrFetcher<T>(key: string | [string, ...unknown[]]): Promise<T> {
  const path = Array.isArray(key) ? (key[0] as string) : key
  return apiClient.get<T>(path)
}
