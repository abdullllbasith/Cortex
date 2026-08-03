import { NextResponse } from 'next/server'
import { BusinessKnowledgeType } from '@prisma/client'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { knowledgeRepository } from '@/lib/knowledge/knowledgeRepository'
import { apiSuccess } from '@/lib/knowledge/response'
import { DocumentParseError, parseKnowledgeDocument, resolveKnowledgeMimeType } from '@/lib/knowledge/documentParser'
import { MAX_UPLOAD_BYTES, validateUploadedFile } from '@/lib/security/sanitizer'

export const runtime = 'nodejs'

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return handleRouteError(new DocumentParseError('File is required'))
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const resolvedMime = resolveKnowledgeMimeType(file.name, file.type)
    const validation = await validateUploadedFile({
      mimeType: resolvedMime || file.type || 'application/octet-stream',
      size: buffer.byteLength,
      buffer,
    })

    if (!validation.valid) {
      return handleRouteError(new DocumentParseError(validation.error ?? 'Invalid file'))
    }

    if (buffer.byteLength > MAX_UPLOAD_BYTES) {
      return handleRouteError(new DocumentParseError('File exceeds maximum size of 10 MB'))
    }

    const { title, content } = await parseKnowledgeDocument(file.name, file.type, buffer)

    const record = await knowledgeRepository.createKnowledge(
      auth.tenantId,
      {
        type: BusinessKnowledgeType.DOCUMENT,
        title,
        content,
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || null,
          uploadedAt: new Date().toISOString(),
        },
      },
      auth.userId,
    )

    return NextResponse.json(apiSuccess(record), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})
