'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#social', label: 'Customers' },
]

export function MarketingNavbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 16)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b border-[#1E2D3D]/10 bg-white/90 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-[#0d1b2a]/90'
          : 'border-b border-transparent bg-white/70 backdrop-blur-md dark:bg-[#0d1b2a]/70'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">

        {/* Brand lockup */}
        <Link href="/" className="flex items-center gap-3 group" style={{ textDecoration: 'none' }}>
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
            <svg viewBox="0 0 32 32" fill="none" className="h-8 w-8">
              <rect x="2"  y="2"  width="13" height="13" rx="3" fill="url(#navG1)" opacity="0.88" />
              <rect x="17" y="17" width="13" height="13" rx="3" fill="url(#navG2)" />
              <defs>
                <linearGradient id="navG1" x1="2" y1="2" x2="15" y2="15" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#7ECAC3" />
                  <stop offset="1" stopColor="#5BA8A0" />
                </linearGradient>
                <linearGradient id="navG2" x1="17" y1="17" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#5BA8A0" />
                  <stop offset="1" stopColor="#3D8E87" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-display text-lg font-bold tracking-tight text-[#1E2D3D] dark:text-white group-hover:text-[#5BA8A0] transition-colors duration-200">
              SAIOS
            </span>
            <span className="text-[10px] font-medium tracking-wide text-[#5BA8A0]/80 dark:text-[#7ECAC3]/70">
              by Softora
            </span>
          </div>
        </Link>

        {/* Nav links */}
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

        {/* CTA */}
        <div className="flex items-center gap-3">
          <Link href="/login" style={{ textDecoration: 'none' }}>
            <span className="cursor-pointer text-sm font-medium text-[#1E2D3D]/70 transition-colors duration-200 hover:text-[#5BA8A0] dark:text-white/70 dark:hover:text-[#7ECAC3] px-3 py-1.5 rounded-md">
              Sign in
            </span>
          </Link>
          <Link href="/register" style={{ textDecoration: 'none' }}>
            <span className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-[#5BA8A0] to-[#3D8E87] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:from-[#4D9990] hover:to-[#2F7D76] hover:shadow-md active:scale-[0.98]">
              Start free
            </span>
          </Link>
        </div>
      </div>
    </header>
  )
}
