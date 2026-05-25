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

async function parsePdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: buffer })
  try {
    const result = await parser.getText()
    return result.text
  } finally {
    await parser.destroy()
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
