'use client'

import Link from 'next/link'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Menu, X, ChevronRight } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { SaiosBrandLockup } from '@/components/branding/SaiosBrandLockup'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#social', label: 'Customers' },
]

const MENU_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'

export function MarketingNavbar() {
  const [scrolled, setScrolled] = useState(false)
  const [navVisible, setNavVisible] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const lastScrollY = useRef(0)

  const closeMobile = useCallback(() => setMobileOpen(false), [])
  const openMobile = useCallback(() => setMobileOpen(true), [])

  useEffect(() => {
    document.documentElement.style.scrollBehavior = 'smooth'
    document.documentElement.style.scrollPaddingTop = '5.5rem'
    return () => {
      document.documentElement.style.scrollPaddingTop = ''
    }
  }, [])

  useEffect(() => {
    lastScrollY.current = window.scrollY

    const handleScroll = () => {
      const currentY = window.scrollY
      setScrolled(currentY > 12)

      if (currentY <= 24) {
        setNavVisible(true)
        lastScrollY.current = currentY
        return
      }

      const delta = currentY - lastScrollY.current
      if (Math.abs(delta) < 6) return

      if (delta > 0) {
        setNavVisible(false)
      } else {
        setNavVisible(true)
      }

      lastScrollY.current = currentY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (!mobileOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMobile()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [mobileOpen, closeMobile])

  const shellCls = cn(
    'pointer-events-auto w-full max-w-6xl rounded-2xl border transition-all duration-300',
    'bg-white/95 shadow-[0_8px_30px_rgba(30,45,61,0.08)] backdrop-blur-xl',
    'dark:bg-[#0d1b2a]/95 dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]',
    scrolled
      ? 'border-[#1E2D3D]/10 dark:border-white/10'
      : 'border-[#1E2D3D]/[0.06] dark:border-white/[0.08]',
  )

  return (
    <>
      {/* Floating fixed navbar shell */}
      <div
        className={cn(
          'pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4 transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] md:px-6 md:pt-5',
          navVisible || mobileOpen ? 'translate-y-0' : '-translate-y-[calc(100%+1.5rem)]',
        )}
      >
        <header className={shellCls}>
          <div className="flex h-14 items-center justify-between gap-4 px-4 md:h-16 md:px-6">
            <SaiosBrandLockup size={22} priority />

            <nav className="hidden items-center gap-8 md:flex">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  style={{ textDecoration: 'none' }}
                  className="text-sm font-semibold text-[#1E2D3D] transition-colors duration-200 hover:text-[#5BA8A0] dark:text-white dark:hover:text-[#7ECAC3]"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-1 md:gap-2">
              <div className="hidden md:block">
                <ThemeToggle />
              </div>
              <Link href="/login" style={{ textDecoration: 'none' }} className="hidden md:inline-flex">
                <span className="cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium text-[#1E2D3D]/70 transition-colors duration-200 hover:text-[#5BA8A0] dark:text-white/70 dark:hover:text-[#7ECAC3]">
                  Sign in
                </span>
              </Link>
              <Link href="/register" style={{ textDecoration: 'none' }} className="hidden md:inline-flex">
                <span className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-[#5BA8A0] to-[#3D8E87] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:from-[#4D9990] hover:to-[#2F7D76] hover:shadow-md active:scale-[0.98]">
                  Start free
                </span>
              </Link>

              <button
                type="button"
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileOpen}
                onClick={mobileOpen ? closeMobile : openMobile}
                className={cn(
                  'flex h-10 w-10 touch-manipulation items-center justify-center rounded-xl md:hidden',
                  'text-[#1E2D3D] transition-transform duration-100 active:scale-95',
                  'hover:bg-[#1E2D3D]/5 dark:text-white dark:hover:bg-white/10',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5BA8A0]',
                )}
              >
                {mobileOpen ? (
                  <X className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Menu className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </header>
      </div>

      {/* Mobile menu — always mounted, CSS transitions (no Radix portal delay) */}
      <div
        className={cn(
          'fixed inset-0 z-[60] md:hidden',
          mobileOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          aria-label="Close menu"
          tabIndex={mobileOpen ? 0 : -1}
          onClick={closeMobile}
          className={cn(
            'absolute inset-0 bg-[#1E2D3D]/50',
            'transition-opacity duration-200 ease-out',
            mobileOpen ? 'opacity-100' : 'opacity-0',
          )}
        />

        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          aria-hidden={!mobileOpen}
          className={cn(
            'absolute inset-x-4 top-4 flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden',
            'rounded-2xl border border-[#1E2D3D]/10 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0d1b2a]',
            'will-change-transform',
            mobileOpen
              ? 'translate-y-0 scale-100 opacity-100'
              : 'pointer-events-none -translate-y-3 scale-[0.98] opacity-0',
          )}
          style={{
            transition: mobileOpen
              ? `transform 240ms ${MENU_EASE}, opacity 180ms ease-out`
              : `transform 200ms ${MENU_EASE}, opacity 160ms ease-in`,
          }}
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#1E2D3D]/8 px-4 dark:border-white/10">
            <SaiosBrandLockup compact size="xs" />
            <button
              type="button"
              aria-label="Close menu"
              onClick={closeMobile}
              className={cn(
                'flex h-10 w-10 touch-manipulation items-center justify-center rounded-xl',
                'text-[#1E2D3D] transition-transform duration-100 active:scale-95',
                'hover:bg-[#1E2D3D]/5 dark:text-white dark:hover:bg-white/10',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5BA8A0]',
              )}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-3">
            <ul className="space-y-1">
              {NAV_LINKS.map((link, index) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={closeMobile}
                    style={{ textDecoration: 'none' }}
                    className={cn(
                      'flex items-center justify-between rounded-xl px-3 py-3 text-sm font-semibold transition-colors duration-150',
                      index === 0
                        ? 'bg-[#1E2D3D]/[0.04] text-[#1E2D3D] dark:bg-white/10 dark:text-white'
                        : 'text-[#1E2D3D]/80 hover:bg-[#1E2D3D]/[0.04] dark:text-white/80 dark:hover:bg-white/10',
                    )}
                  >
                    {link.label}
                    <ChevronRight className="h-4 w-4 text-[#1E2D3D]/30 dark:text-white/30" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex items-center justify-between rounded-xl border border-[#1E2D3D]/8 px-3 py-2 dark:border-white/10">
              <span className="text-sm font-medium text-[#1E2D3D]/70 dark:text-white/70">Appearance</span>
              <ThemeToggle size="md" />
            </div>
          </nav>

          <div className="shrink-0 space-y-2 border-t border-[#1E2D3D]/8 p-4 dark:border-white/10">
            <Link href="/login" style={{ textDecoration: 'none' }} onClick={closeMobile}>
              <span className="flex h-11 w-full items-center justify-center rounded-xl border border-[#1E2D3D]/10 text-sm font-semibold text-[#1E2D3D] transition-colors hover:bg-[#1E2D3D]/5 dark:border-white/15 dark:text-white dark:hover:bg-white/10">
                Sign in
              </span>
            </Link>
            <Link href="/register" style={{ textDecoration: 'none' }} onClick={closeMobile}>
              <span className="flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-br from-[#5BA8A0] to-[#3D8E87] text-sm font-semibold text-white shadow-sm transition-all hover:from-[#4D9990] hover:to-[#2F7D76]">
                Start free
              </span>
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
