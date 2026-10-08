import {
  isSupportedKnowledgeUpload,
  resolveKnowledgeMimeType,
} from '@/lib/knowledge/documentParser'
import { normalizeUploadMimeType } from '@/lib/security/sanitizer'

describe('knowledge document upload mime handling', () => {
  it('resolves extension when browser sends octet-stream', () => {
    expect(resolveKnowledgeMimeType('policy.pdf', 'application/octet-stream')).toBe(
      'application/pdf',
    )
    expect(resolveKnowledgeMimeType('notes.txt', '')).toBe('text/plain')
    expect(resolveKnowledgeMimeType('list.csv', 'application/octet-stream')).toBe('text/csv')
    expect(resolveKnowledgeMimeType('brief.docx', '')).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )
  })

  it('normalizes Windows CSV MIME alias', () => {
    expect(resolveKnowledgeMimeType('export.csv', 'application/vnd.ms-excel')).toBe('text/csv')
    expect(normalizeUploadMimeType('application/vnd.ms-excel')).toBe('text/csv')
  })

  it('accepts only knowledge upload formats', () => {
    expect(isSupportedKnowledgeUpload('a.pdf')).toBe(true)
    expect(isSupportedKnowledgeUpload('a.docx')).toBe(true)
    expect(isSupportedKnowledgeUpload('a.csv')).toBe(true)
    expect(isSupportedKnowledgeUpload('a.txt')).toBe(true)
    expect(isSupportedKnowledgeUpload('photo.png')).toBe(false)
    expect(isSupportedKnowledgeUpload('archive.zip')).toBe(false)
  })
})
