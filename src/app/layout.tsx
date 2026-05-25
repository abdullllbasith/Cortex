import type { Metadata, Viewport } from 'next'
import { Sora, Inter, JetBrains_Mono } from 'next/font/google'
import { AppProviders } from '@/providers/AppProviders'
import '@/styles/globals.css'

/* ── Google Fonts — optimised via next/font (self-hosted, no FOUT) ─────── */

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['400', '500'],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
  weight: ['400', '500'],
})

/* ── Metadata ────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  metadataBase: new URL('https://saios.softora.ai'),
  title: {
    template: 'SAIOS | %s',
    default: 'SAIOS — Softora Enterprise AI Operating System',
  },
  description:
    'SAIOS is an enterprise-grade AI operating system that unifies intelligence, knowledge, analytics, and automation across your organisation.',
  keywords: ['AI', 'enterprise', 'operating system', 'analytics', 'automation', 'knowledge base'],
  authors: [{ name: 'Softora', url: 'https://softora.ai' }],
  openGraph: {
    type: 'website',
    siteName: 'SAIOS',
    title: 'SAIOS — Enterprise AI Operating System',
    description: 'Unified AI platform for enterprise intelligence and automation.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'SAIOS' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SAIOS — Enterprise AI Operating System',
    images: ['/og-image.png'],
  },
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)',  color: '#0f172a' },
  ],
}

/* ── Root Layout ─────────────────────────────────────────────────────────── */

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sora.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body
        suppressHydrationWarning
        className="min-h-screen bg-background font-body antialiased"
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
