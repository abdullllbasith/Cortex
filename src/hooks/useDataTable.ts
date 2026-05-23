'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { SortDirection } from '@/components/data/DataTable'
import type { FilterValues } from '@/components/data/FilterDrawer'

/* ─────────────────────────────────────────────────────────────────────────────
   Types
   ───────────────────────────────────────────────────────────────────────────── */

export interface UseDataTableOptions {
  initialPage?:       number
  initialLimit?:      number
  initialSearch?:     string
  initialSortKey?:    string
  initialSortDir?:    'asc' | 'desc'
  initialFilters?:    FilterValues
  /** Sync state to URL query params */
  syncUrl?:           boolean
  /** Total records (needed for pagination props) */
  total?:             number
}

export interface UseDataTableState {
  page:       number
  limit:      number
  search:     string
  sortKey:    string | null
  sortDir:    SortDirection
  filters:    FilterValues
  selected:   Set<string>
  filterOpen: boolean
}

export interface UseDataTableReturn<TData> {
  // Raw state
  state: UseDataTableState
  // Handlers
  setPage:       (p: number) => void
  setLimit:      (l: number) => void
  setSearch:     (s: string) => void
  setSort:       (key: string, dir?: 'asc' | 'desc') => void
  setFilters:    (f: FilterValues) => void
  setSelected:   (rows: TData[]) => void
  openFilter:    () => void
  closeFilter:   () => void
  resetFilters:  () => void
  // Derived
  activeFilterCount: number
  // Ready-to-spread prop sets
  tableProps: {
    sortKey:       string | undefined
    sortDirection: SortDirection
    onSort:        (key: string, dir: 'asc' | 'desc') => void
    onSelectionChange: (rows: TData[]) => void
  }
  toolbarProps: {
    search:        string
    onSearch:      (s: string) => void
    onFilterOpen:  () => void
    filterCount:   number
  }
  paginationProps: {
    page:          number
    limit:         number
    total:         number
    onPageChange:  (p: number) => void
    onLimitChange: (l: number) => void
  }
  filterDrawerProps: {
    open:         boolean
    onOpenChange: (o: boolean) => void
    values:       FilterValues
    onChange:     (f: FilterValues) => void
    onApply:      (f: FilterValues) => void
    onReset:      () => void
    activeCount:  number
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   URL helpers (browser-only, no Suspense required)
   ───────────────────────────────────────────────────────────────────────────── */

function getParam(key: string): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(key)
}

/* ─────────────────────────────────────────────────────────────────────────────
   useDataTable
   ───────────────────────────────────────────────────────────────────────────── */

export function useDataTable<TData extends Record<string, unknown>>(
  options: UseDataTableOptions = {},
): UseDataTableReturn<TData> {
  const {
    initialPage    = 1,
    initialLimit   = 25,
    initialSearch  = '',
    initialSortKey = null,
    initialSortDir = null,
    initialFilters = {},
    syncUrl        = false,
    total          = 0,
  } = options

  const router   = useRouter()
  const pathname = usePathname()
  const mounted  = useRef(false)

  /* ── State ──────────────────────────────────────────────────────────────── */

  const [page,       setPageRaw]    = useState(() => syncUrl ? Number(getParam('page') ?? initialPage) : initialPage)
  const [limit,      setLimitRaw]   = useState(() => syncUrl ? Number(getParam('limit') ?? initialLimit) : initialLimit)
  const [search,     setSearchRaw]  = useState(() => syncUrl ? (getParam('q') ?? initialSearch) : initialSearch)
  const [sortKey,    setSortKey]     = useState<string | null>(() => syncUrl ? (getParam('sortKey') ?? initialSortKey) : initialSortKey)
  const [sortDir,    setSortDir]     = useState<SortDirection>(() => {
    const p = syncUrl ? getParam('sortDir') : null
    return (p as SortDirection) ?? initialSortDir
  })
  const [filters,    setFiltersRaw]  = useState<FilterValues>(initialFilters)
  const [selected,   setSelectedRaw] = useState<Set<string>>(new Set())
  const [filterOpen, setFilterOpen]  = useState(false)

  /* ── URL sync ────────────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!syncUrl || !mounted.current) return
    const params = new URLSearchParams(window.location.search)
    if (page  !== initialPage)  params.set('page',    String(page))  ; else params.delete('page')
    if (limit !== initialLimit) params.set('limit',   String(limit)) ; else params.delete('limit')
    if (search)                 params.set('q',       search)        ; else params.delete('q')
    if (sortKey)                params.set('sortKey', sortKey)       ; else params.delete('sortKey')
    if (sortDir)                params.set('sortDir', sortDir)       ; else params.delete('sortDir')
    const qs = params.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
  }, [page, limit, search, sortKey, sortDir]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { mounted.current = true }, [])

  /* ── Handlers ────────────────────────────────────────────────────────────── */

  const setPage   = useCallback((p: number)   => setPageRaw(p),    [])
  const setLimit  = useCallback((l: number)   => { setLimitRaw(l); setPageRaw(1) }, [])
  const setSearch = useCallback((s: string)   => { setSearchRaw(s); setPageRaw(1) }, [])

  const setSort = useCallback((key: string, dir?: 'asc' | 'desc') => {
    if (dir) {
      setSortKey(key)
      setSortDir(dir)
    } else {
      setSortKey((prev) => {
        if (prev !== key) { setSortDir('asc'); return key }
        setSortDir((d) => { if (d === 'asc') return 'desc'; setSortKey(null); return null })
        return prev
      })
    }
    setPageRaw(1)
  }, [])

  const setFilters   = useCallback((f: FilterValues) => { setFiltersRaw(f); setPageRaw(1) }, [])
  const resetFilters = useCallback(() => { setFiltersRaw({}); setPageRaw(1); setFilterOpen(false) }, [])

  const setSelected  = useCallback(
    (rows: TData[]) => setSelectedRaw(new Set(rows.map((r) => String(r.id ?? r[Object.keys(r)[0]])))),
    [],
  )

  const openFilter  = useCallback(() => setFilterOpen(true), [])
  const closeFilter = useCallback(() => setFilterOpen(false), [])

  const activeFilterCount = Object.values(filters).filter((v) =>
    v !== undefined && v !== null && v !== '' &&
    !(Array.isArray(v) && v.length === 0) &&
    !(typeof v === 'object' && !Array.isArray(v) && Object.values(v as object).every((x) => x == null || x === '')),
  ).length

  /* ── Return ──────────────────────────────────────────────────────────────── */

  return {
    state: { page, limit, search, sortKey, sortDir, filters, selected, filterOpen },

    setPage, setLimit, setSearch, setSort, setFilters,
    setSelected, openFilter, closeFilter, resetFilters,

    activeFilterCount,

    tableProps: {
      sortKey:           sortKey ?? undefined,
      sortDirection:     sortDir,
      onSort:            setSort,
      onSelectionChange: setSelected,
    },

    toolbarProps: {
      search,
      onSearch:     setSearch,
      onFilterOpen: openFilter,
      filterCount:  activeFilterCount,
    },

    paginationProps: {
      page,
      limit,
      total,
      onPageChange:  setPage,
      onLimitChange: setLimit,
    },

    filterDrawerProps: {
      open:         filterOpen,
      onOpenChange: (o) => (o ? openFilter() : closeFilter()),
      values:       filters,
      onChange:     setFilters,
      onApply:      setFilters,
      onReset:      resetFilters,
      activeCount:  activeFilterCount,
    },
  }
}
