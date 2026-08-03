import { sanitizePostgresText } from '@/lib/knowledge/sanitizeText'
import { DocumentParseError } from '@/lib/knowledge/documentParseErrors'

export { DocumentParseError } from '@/lib/knowledge/documentParseErrors'

const MAX_CONTENT_CHARS = 50_000

const EXTENSION_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  csv: 'text/csv',
  txt: 'text/plain',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

export function resolveKnowledgeMimeType(fileName: string, mimeType: string): string {
  if (mimeType && mimeType !== 'application/octet-stream') return mimeType
  const ext = fileName.split('.').pop()?.toLowerCase()
  return ext ? EXTENSION_MIME[ext] ?? mimeType : mimeType
}

function toFriendlyPdfError(err: unknown): DocumentParseError {
  const message = err instanceof Error ? err.message : 'Failed to parse PDF'

  if (/Object\.defineProperty called on non-object/i.test(message)) {
    return new DocumentParseError(
      'Could not read this PDF in the server runtime. Try restarting the dev server, or upload a text-based PDF / TXT.',
    )
  }
  if (/Array buffer allocation failed|JavaScript heap out of memory|ENOMEM/i.test(message)) {
    return new DocumentParseError(
      'This PDF is too large to process in memory. Try a smaller file (under ~5 MB) or export as TXT.',
    )
  }
  if (/password|encrypted/i.test(message)) {
    return new DocumentParseError('This PDF is password-protected. Remove the password and try again.')
  }
  if (message.length <= 160 && !/__TURBOPACK__|node_modules/i.test(message)) {
    return new DocumentParseError(message)
  }
  return new DocumentParseError('Could not extract text from this PDF. Try a text-based PDF or TXT.')
}

async function parsePdf(buffer: Buffer): Promise<string> {
  // Required for Next.js / serverless — initializes pdf.js worker before PDFParse.
  await import('pdf-parse/worker')
  const { PDFParse } = await import('pdf-parse')

  // pdf.js expects a Uint8Array; Node Buffer can trigger defineProperty crashes.
  const data = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  const parser = new PDFParse({ data })

  try {
    const result = await parser.getText()
    return result.text ?? ''
  } catch (err) {
    throw toFriendlyPdfError(err)
  } finally {
    try {
      await parser.destroy()
    } catch {
      /* ignore cleanup errors */
    }
  }
}

function parsePlainText(buffer: Buffer): string {
  return buffer.toString('utf8')
}

export async function parseKnowledgeDocument(
  fileName: string,
  mimeType: string,
  buffer: Buffer,
): Promise<{ title: string; content: string }> {
  const resolvedMime = resolveKnowledgeMimeType(fileName, mimeType)
  const title = fileName.replace(/\.[^.]+$/, '')

  let raw = ''

  if (resolvedMime === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
    raw = await parsePdf(buffer)
  } else if (
    resolvedMime === 'text/plain'
    || resolvedMime === 'text/csv'
    || fileName.toLowerCase().endsWith('.txt')
    || fileName.toLowerCase().endsWith('.csv')
  ) {
    raw = parsePlainText(buffer)
  } else if (
    resolvedMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || fileName.toLowerCase().endsWith('.docx')
  ) {
    throw new DocumentParseError(
      'DOCX is not supported yet. Please upload PDF, CSV, or TXT.',
    )
  } else {
    throw new DocumentParseError(
      'Unsupported file type. Please upload PDF, CSV, or TXT.',
    )
  }

  const content = sanitizePostgresText(raw).slice(0, MAX_CONTENT_CHARS)

  if (!content) {
    throw new DocumentParseError(
      'No readable text found in this file. Try a text-based PDF or export as TXT.',
    )
  }

  return { title: sanitizePostgresText(title) || 'Untitled document', content }
}
