import { NextResponse } from 'next/server'

const INVITES: Record<string, { inviterName: string; companyName: string; email: string }> = {
  demo: {
    inviterName: 'Sarah Chen',
    companyName: 'Acme Industries',
    email: 'you@company.com',
  },
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const invite = INVITES[token] ?? {
    inviterName: 'Team Admin',
    companyName: 'SAIOS Workspace',
    email: '',
  }

  return NextResponse.json({ ...invite, token })
}
