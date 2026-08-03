import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

const RESERVED = new Set(['admin', 'api', 'app', 'dashboard', 'saios', 'softora', 'cortex', 'demo', 'test', 'www'])

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')?.toLowerCase().trim()

  if (!slug) {
    return NextResponse.json({ available: false, message: 'Slug is required' }, { status: 400 })
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3) {
    return NextResponse.json({ available: false, message: 'Invalid slug format' })
  }

  if (RESERVED.has(slug)) {
    return NextResponse.json({ available: false, slug, message: 'Reserved slug' })
  }

  const existing = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } })
  return NextResponse.json({ available: !existing, slug })
}
