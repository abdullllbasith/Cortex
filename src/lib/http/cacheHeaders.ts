/** Shared Cache-Control helpers for API routes (browser + CDN). */

function devDisablesHttpCache(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.AUTH_DEV_MODE === 'true'
}

export function publicCacheHeaders(maxAge = 60, staleWhileRevalidate = 300): HeadersInit {
  if (devDisablesHttpCache()) return noStoreHeaders()
  return {
    'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
  }
}

/** User/tenant-scoped GET responses — private browser cache only. */
export function privateCacheHeaders(maxAge = 60, staleWhileRevalidate = 120): HeadersInit {
  if (devDisablesHttpCache()) return noStoreHeaders()
  return {
    'Cache-Control': `private, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
    Vary: 'Authorization, x-tenant-id',
  }
}

export function noStoreHeaders(): HeadersInit {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    Pragma: 'no-cache',
  }
}

/** Tenant-scoped analytics GET responses. */
export function analyticsCacheHeaders(maxAge = 60, swr = 300): HeadersInit {
  if (devDisablesHttpCache()) return noStoreHeaders()
  return privateCacheHeaders(maxAge, swr)
}
