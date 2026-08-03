import type { Metadata, Viewport } from 'next'
import { Sora, Inter, JetBrains_Mono } from 'next/font/google'
import { AppProviders } from '@/providers/AppProviders'
import { SOFTORA_FAVICON } from '@/lib/branding/logoAssets'
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
  metadataBase: new URL('https://cortex.app'),
  title: {
    template: 'Cortex | %s',
    default: 'Cortex — Enterprise AI Operating System',
  },
  description:
    'Cortex is an enterprise-grade AI operating system that unifies intelligence, knowledge, analytics, and automation across your organisation.',
  keywords: ['AI', 'enterprise', 'operating system', 'analytics', 'automation', 'knowledge base'],
  authors: [{ name: 'Cortex', url: 'https://cortex.app' }],
  openGraph: {
    type: 'website',
    siteName: 'Cortex',
    title: 'Cortex — Enterprise AI Operating System',
    description: 'Unified AI platform for enterprise intelligence and automation.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Cortex' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cortex — Enterprise AI Operating System',
    images: ['/og-image.png'],
  },
  robots: { index: false, follow: false },
  icons: {
    icon: [{ url: SOFTORA_FAVICON, type: 'image/png' }],
    apple: [{ url: SOFTORA_FAVICON, type: 'image/png' }],
    shortcut: [SOFTORA_FAVICON],
  },
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
