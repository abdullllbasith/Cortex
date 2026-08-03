import { NextRequest } from 'next/server'
import request from 'supertest'
import { createServer } from 'http'

jest.mock('@/lib/knowledge/apiHandler', () => ({
  withTenantAuth: (handler: (req: NextRequest, ctx: { auth: { tenantId: string; userId: string; permissions: string[] }; params: Promise<Record<string, string>> }) => Promise<Response>) =>
    (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) =>
      handler(req, {
        ...ctx,
        auth: { tenantId: 'tenant-1', userId: 'dev-user', permissions: ['*'] },
      }),
  handleRouteError: (err: unknown) => {
    const { ZodError } = jest.requireActual('zod')
    const { NextResponse } = jest.requireActual('next/server')
    if (err instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed' } },
        { status: 400 },
      )
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: String(err) } },
      { status: 500 },
    )
  },
}))

jest.mock('@/lib/assistant/rateLimiter', () => ({
  checkAssistantRateLimit: jest.fn().mockResolvedValue({ allowed: true, retryAfter: 0 }),
}))

jest.mock('@/lib/assistant/conversationMemory', () => ({
  createSession: jest.fn().mockResolvedValue({ id: 'sess-new', tenantId: 'tenant-1', userId: 'user-1' }),
  getSession: jest.fn().mockResolvedValue({ id: 'sess-1', tenantId: 'tenant-1', userId: 'dev-user' }),
  getContextWindow: jest.fn().mockResolvedValue({
    recentTurns: [{ role: 'user', content: 'Hello' }],
    summary: undefined,
  }),
  saveMessage: jest.fn().mockResolvedValue({ id: 'msg-1' }),
  updateSessionTitle: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/assistant/conversationEngine', () => ({
  streamConversationEngine: jest.fn().mockImplementation(async function* () {
    yield { type: 'token', content: 'Hello' }
    yield { type: 'token', content: ' there' }
    yield {
      type: 'metadata',
      data: {
        assistantMessage: 'Hello there',
        sourcesUsed: [],
        actionsTaken: [],
        suggestedFollowUps: ['Follow up 1'],
        intent: { intent: 'QUERY', confidence: 0.9, entities: {} },
      },
    }
  }),
}))

jest.mock('@/lib/assistant/presenceHub', () => ({
  publishPresenceEvent: jest.fn(),
}))

// Import route after mocks are registered
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require('../route') as typeof import('../route')

function createTestServer() {
  return createServer(async (req, res) => {
    const url = `http://localhost${req.url ?? '/'}`
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', async () => {
      const body = Buffer.concat(chunks).toString()
      const headers = new Headers()
      for (const [k, v] of Object.entries(req.headers)) {
        if (v) headers.set(k, Array.isArray(v) ? v[0] : v)
      }

      const nextReq = new NextRequest(url, {
        method: req.method,
        headers,
        body: body || undefined,
      })

      const response = await POST(nextReq, { params: Promise.resolve({}) })
      res.statusCode = response.status
      response.headers.forEach((v, k) => res.setHeader(k, v))
      const responseBody = await response.text()
      res.end(responseBody)
    })
  })
}

describe('POST /api/assistant/chat', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, AUTH_DEV_MODE: 'true' }
  })

  afterEach(() => {
    process.env = originalEnv
    jest.clearAllMocks()
  })

  it('streams SSE tokens and ends with [DONE]', async () => {
    const server = createTestServer()
    await new Promise<void>((resolve) => server.listen(0, resolve))
    const addr = server.address()
    const port = typeof addr === 'object' && addr ? addr.port : 0

    const res = await request(`http://127.0.0.1:${port}`)
      .post('/api/assistant/chat')
      .set('Content-Type', 'application/json')
      .set('x-tenant-id', 'tenant-1')
      .send({ message: 'Hello', sessionId: 'sess-1' })
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = []
        r.on('data', (c) => chunks.push(c))
        r.on('end', () => cb(null, Buffer.concat(chunks).toString()))
      })

    server.close()

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/event-stream')
    expect(res.body).toContain('"type":"token"')
    expect(res.body).toContain('Hello')
    expect(res.body).toContain('[DONE]')
    expect(res.body).toContain('"type":"metadata"')
  })

  it('returns 429 when rate limited', async () => {
    const { checkAssistantRateLimit } = jest.requireMock('@/lib/assistant/rateLimiter')
    checkAssistantRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 30 })

    const server = createTestServer()
    await new Promise<void>((resolve) => server.listen(0, resolve))
    const addr = server.address()
    const port = typeof addr === 'object' && addr ? addr.port : 0

    const res = await request(`http://127.0.0.1:${port}`)
      .post('/api/assistant/chat')
      .set('Content-Type', 'application/json')
      .set('x-tenant-id', 'tenant-1')
      .send({ message: 'Hello' })

    server.close()

    expect(res.status).toBe(429)
    expect(res.headers['retry-after']).toBe('30')
  })

  it('returns 400 for empty message', async () => {
    const server = createTestServer()
    await new Promise<void>((resolve) => server.listen(0, resolve))
    const addr = server.address()
    const port = typeof addr === 'object' && addr ? addr.port : 0

    const res = await request(`http://127.0.0.1:${port}`)
      .post('/api/assistant/chat')
      .set('Content-Type', 'application/json')
      .set('x-tenant-id', 'tenant-1')
      .send({ message: '' })

    server.close()

    expect(res.status).toBe(400)
  })
})
