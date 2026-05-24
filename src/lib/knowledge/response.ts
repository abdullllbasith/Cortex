import { NextResponse } from 'next/server'

export interface ApiSuccessResponse<T> {
  success: true
  data: T
  meta?: Record<string, unknown>
  error: null
}

export interface ApiErrorResponse {
  success: false
  data: null
  meta?: Record<string, unknown>
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

export function apiSuccess<T>(data: T, meta?: Record<string, unknown>): ApiSuccessResponse<T> {
  return { success: true, data, meta: meta ?? {}, error: null }
}

export function apiError(
  message: string,
  code: string,
  status: number,
  details?: Record<string, unknown>,
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: { code, message, details },
    },
    { status },
  )
}

export function paginatedMeta(page: number, limit: number, total: number, cursor?: string | null) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    cursor: cursor ?? null,
    hasMore: page * limit < total,
  }
}
