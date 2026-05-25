import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { generateQuotePDF, markQuoteViewed } from '@/lib/sales/quoteService'

export const GET = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const url = new URL(request.url)
    if (url.searchParams.get('track') === 'view') {
      await markQuoteViewed(id, auth.tenantId)
    }
    const buffer = await generateQuotePDF(auth.tenantId, id)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="quote-${id}.pdf"`,
      },
    })
  } catch (err) {
    return handleRouteError(err)
  }
})
