'use client'

import { useCallback, useState } from 'react'
import { Upload, FileText, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui'
import { apiClient } from '@/lib/api/apiClient'
import { ApiError } from '@/lib/api/types'
import toast from 'react-hot-toast'

const ACCEPTED = '.pdf,.docx,.csv,.txt'

function formatUploadError(err: unknown): string {
  if (err instanceof ApiError) {
    const msg = err.message
    if (
      err.code === 'PARSE_ERROR'
      || err.code === 'VALIDATION_ERROR'
      || (msg.length <= 160 && !/prisma|turbopack|connectorerror/i.test(msg))
    ) {
      return msg
    }
    return 'Upload failed. Please use PDF, CSV, or TXT and try again.'
  }
  if (err instanceof Error && err.message.length <= 160) {
    return err.message
  }
  return 'Upload failed. Please try again.'
}

export interface KnowledgeUploaderProps {
  onUploaded?: () => void
  className?: string
}

export function KnowledgeUploader({ onUploaded, className }: KnowledgeUploaderProps) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      await apiClient.upload('/knowledge/upload', formData)

      const title = file.name.replace(/\.[^.]+$/, '')
      toast.success(`"${title}" uploaded and queued for indexing`)
      onUploaded?.()
    } catch (err) {
      const message = formatUploadError(err)
      setError(message)
      toast.error(message)
    } finally {
      setUploading(false)
    }
  }, [onUploaded])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) await uploadFile(file)
  }, [uploadFile])

  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors',
          dragging
            ? 'border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20'
            : 'border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-900/50',
        )}
      >
        {uploading ? (
          <Spinner size="md" />
        ) : (
          <>
            <Upload className="mb-3 h-8 w-8 text-slate-400" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Drag & drop files here
            </p>
            <p className="mt-1 text-xs text-slate-400">PDF, DOCX, CSV, TXT</p>
            <label className="mt-4 cursor-pointer rounded-md bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700">
              Browse files
              <input
                type="file"
                accept={ACCEPTED}
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void uploadFile(file)
                }}
              />
            </label>
          </>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex min-w-0 items-start gap-2 overflow-hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1 break-words">{error}</p>
        </div>
      )}

      <p className="flex items-center gap-1 text-[10px] text-slate-400">
        <FileText className="h-3 w-3" />
        Files are parsed and stored in BusinessKnowledge with automatic embedding
      </p>
    </div>
  )
}
