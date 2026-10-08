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

/** Browser / OS MIME aliases → canonical types we accept for knowledge uploads. */
const MIME_ALIASES: Record<string, string> = {
  'application/csv': 'text/csv',
  'text/x-csv': 'text/csv',
  'application/x-csv': 'text/csv',
  'application/vnd.ms-excel': 'text/csv', // Windows often tags .csv this way
}

export const KNOWLEDGE_UPLOAD_EXTENSIONS = ['.pdf', '.docx', '.csv', '.txt'] as const

export function resolveKnowledgeMimeType(fileName: string, mimeType: string): string {
  const normalizedInput = (mimeType || '').split(';')[0]?.trim().toLowerCase() ?? ''
  const aliased = MIME_ALIASES[normalizedInput] ?? normalizedInput
  if (aliased && aliased !== 'application/octet-stream') return aliased

  const ext = fileName.split('.').pop()?.toLowerCase()
  return ext ? EXTENSION_MIME[ext] ?? aliased : aliased
}

export function isSupportedKnowledgeUpload(fileName: string, mimeType = ''): boolean {
  const resolved = resolveKnowledgeMimeType(fileName, mimeType)
  return (
    resolved === 'application/pdf'
    || resolved === 'text/csv'
    || resolved === 'text/plain'
    || resolved === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || KNOWLEDGE_UPLOAD_EXTENSIONS.some((ext) => fileName.toLowerCase().endsWith(ext))
  )
}

function toFriendlyPdfError(err: unknown): DocumentParseError {
  const message = err instanceof Error ? err.message : 'Failed to parse PDF'

  if (/Cannot find module ['"]pdf-parse\/worker['"]/i.test(message)) {
    return new DocumentParseError(
      'PDF support is not installed correctly on the server. Ask an admin to reinstall dependencies (pdf-parse@2).',
    )
  }
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

async function parseDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value ?? ''
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to parse DOCX'
    if (message.length <= 160 && !/__TURBOPACK__|node_modules/i.test(message)) {
      throw new DocumentParseError(message)
    }
    throw new DocumentParseError('Could not extract text from this Word document. Try exporting as TXT or PDF.')
  }
}

export async function parseKnowledgeDocument(
  fileName: string,
  mimeType: string,
  buffer: Buffer,
): Promise<{ title: string; content: string }> {
  const resolvedMime = resolveKnowledgeMimeType(fileName, mimeType)
  const title = fileName.replace(/\.[^.]+$/, '')
  const lowerName = fileName.toLowerCase()

  let raw = ''

  if (resolvedMime === 'application/pdf' || lowerName.endsWith('.pdf')) {
    raw = await parsePdf(buffer)
  } else if (
    resolvedMime === 'text/plain'
    || resolvedMime === 'text/csv'
    || lowerName.endsWith('.txt')
    || lowerName.endsWith('.csv')
  ) {
    raw = parsePlainText(buffer)
  } else if (
    resolvedMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || lowerName.endsWith('.docx')
  ) {
    raw = await parseDocx(buffer)
  } else {
    throw new DocumentParseError(
      'Unsupported file type. Please upload PDF, DOCX, CSV, or TXT.',
    )
  }

  const content = sanitizePostgresText(raw).slice(0, MAX_CONTENT_CHARS)

  if (!content) {
    throw new DocumentParseError(
      'No readable text found in this file. Try a text-based PDF/DOCX or export as TXT.',
    )
  }

  return { title: sanitizePostgresText(title) || 'Untitled document', content }
}
