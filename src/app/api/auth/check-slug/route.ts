import { NextResponse } from 'next/server'

const TAKEN_SLUGS = new Set(['admin', 'api', 'app', 'dashboard', 'saios', 'softora', 'demo', 'test'])

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')?.toLowerCase().trim()

  if (!slug) {
    return NextResponse.json({ available: false, message: 'Slug is required' }, { status: 400 })
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return NextResponse.json({ available: false, message: 'Invalid slug format' })
  }

  const available = !TAKEN_SLUGS.has(slug) && slug.length >= 3

  return NextResponse.json({ available, slug })
}
