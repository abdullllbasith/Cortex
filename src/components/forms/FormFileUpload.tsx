'use client'

import { useCallback, useRef, useState } from 'react'
import { Controller, useFormContext, type FieldPath, type FieldValues } from 'react-hook-form'
import { Upload, X, FileText, ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FormField } from './FormField'
import { uploadToStorage } from '@/lib/supabase/client'
import { FORM_MESSAGES } from '@/lib/forms/formConfig'
import { toast } from '@/components/ui'

export interface UploadedFile {
  name: string
  size: number
  type: string
  url: string
  path?: string
}

export interface FormFileUploadProps<T extends FieldValues> {
  name: FieldPath<T>
  label?: string
  helperText?: string
  required?: boolean
  /** Accepted MIME types or extensions e.g. ['image/*', '.pdf'] */
  fileTypes?: string[]
  /** Max file size in bytes */
  maxSize?: number
  multiple?: boolean
  /** Supabase Storage bucket name */
  bucket?: string
  /** Path prefix inside bucket */
  pathPrefix?: string
  disabled?: boolean
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function inferMimeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  if (!ext) return 'application/octet-stream'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
    return `image/${ext === 'jpg' ? 'jpeg' : ext}`
  }
  if (ext === 'pdf') return 'application/pdf'
  return 'application/octet-stream'
}

function normalizeUploadedFile(value: unknown): UploadedFile | null {
  if (!value) return null

  if (typeof value === 'string') {
    const name = value.split('/').pop()?.split('?')[0] ?? 'upload'
    return {
      name,
      size: 0,
      type: inferMimeFromName(name),
      url: value,
    }
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const url = typeof record.url === 'string' ? record.url : ''
    if (!url) return null

    const name =
      typeof record.name === 'string'
        ? record.name
        : url.split('/').pop()?.split('?')[0] ?? 'upload'

    return {
      name,
      size: typeof record.size === 'number' ? record.size : 0,
      type: typeof record.type === 'string' ? record.type : inferMimeFromName(name),
      url,
      path: typeof record.path === 'string' ? record.path : undefined,
    }
  }

  return null
}

function normalizeUploadedFiles(value: unknown, multiple: boolean): UploadedFile[] {
  if (multiple) {
    if (!Array.isArray(value)) return []
    return value
      .map((item) => normalizeUploadedFile(item))
      .filter((item): item is UploadedFile => item != null)
  }

  const file = normalizeUploadedFile(value)
  return file ? [file] : []
}

function isImageType(type: string | undefined, name?: string): boolean {
  if (type?.startsWith('image/')) return true
  if (name && /\.(jpe?g|png|gif|webp|svg)$/i.test(name)) return true
  return inferMimeFromName(name ?? '').startsWith('image/')
}

export function FormFileUpload<T extends FieldValues>({
  name,
  label,
  helperText,
  required,
  fileTypes = [],
  maxSize = 10 * 1024 * 1024,
  multiple = false,
  bucket = 'uploads',
  pathPrefix = 'forms',
  disabled,
}: FormFileUploadProps<T>) {
  const { control } = useFormContext<T>()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState<Record<string, number>>({})
  const [uploading, setUploading] = useState(false)

  const validateFile = useCallback(
    (file: File): string | null => {
      if (file.size > maxSize) {
        return FORM_MESSAGES.fileTooLarge(Math.round(maxSize / (1024 * 1024)))
      }
      if (fileTypes.length > 0) {
        const mime = file.type || inferMimeFromName(file.name)
        const ok = fileTypes.some((t) => {
          if (t.startsWith('.')) return file.name.toLowerCase().endsWith(t.toLowerCase())
          if (t.endsWith('/*')) return mime.startsWith(t.replace('/*', '/'))
          return mime === t
        })
        if (!ok) return FORM_MESSAGES.fileType
      }
      return null
    },
    [fileTypes, maxSize],
  )

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const files = normalizeUploadedFiles(field.value, multiple)

        const addFiles = async (incoming: FileList | File[]) => {
          const list = Array.from(incoming)
          setUploading(true)

          const uploaded: UploadedFile[] = []

          for (const file of list) {
            const err = validateFile(file)
            if (err) {
              field.onChange(field.value)
              setUploading(false)
              return
            }

            const storagePath = `${pathPrefix}/${Date.now()}-${file.name}`
            setProgress((p) => ({ ...p, [file.name]: 0 }))

            try {
              const result = await uploadToStorage(file, bucket, storagePath, (prog) => {
                setProgress((p) => ({ ...p, [file.name]: prog.percentage }))
              })

              uploaded.push({
                name: file.name,
                size: file.size,
                type: file.type || inferMimeFromName(file.name),
                url: result.publicUrl,
                path: result.path,
              })
            } catch (e) {
              const message = e instanceof Error ? e.message : 'Upload failed'
              toast.error(message)
              console.error(e)
            } finally {
              setProgress((p) => {
                const next = { ...p }
                delete next[file.name]
                return next
              })
            }
          }

          if (multiple) {
            field.onChange([...files, ...uploaded])
          } else if (uploaded[0]) {
            field.onChange(uploaded[0])
          }

          setUploading(false)
        }

        const removeFile = (index: number) => {
          if (multiple) {
            field.onChange(files.filter((_, i) => i !== index))
          } else {
            field.onChange(null)
          }
        }

        const accept = fileTypes.join(',')

        return (
          <FormField
            name={name}
            label={label}
            helperText={helperText}
            required={required}
            error={fieldState.error?.message}
          >
            {/* Drop zone */}
            <div
              role="button"
              tabIndex={0}
              aria-label="Upload files"
              onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                if (!disabled && e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
              }}
              onClick={() => !disabled && inputRef.current?.click()}
              className={cn(
                'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6',
                'cursor-pointer transition-colors',
                dragging
                  ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
                  : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600',
                disabled && 'cursor-not-allowed opacity-50',
                fieldState.error && 'border-red-300 dark:border-red-800',
              )}
            >
              <Upload className="h-8 w-8 text-slate-400" aria-hidden="true" />
              <div className="text-center">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Drop files here or click to browse
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Max {formatBytes(maxSize)}
                  {fileTypes.length > 0 && ` · ${fileTypes.join(', ')}`}
                </p>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept={accept || undefined}
                multiple={multiple}
                disabled={disabled || uploading}
                className="sr-only"
                onChange={(e) => {
                  if (e.target.files?.length) addFiles(e.target.files)
                  e.target.value = ''
                }}
              />
            </div>

            {/* Upload progress */}
            {Object.entries(progress).map(([fname, pct]) => (
              <div key={fname} className="mt-2">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span className="truncate">{fname}</span>
                  <span>{Math.round(pct)}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            ))}

            {/* File previews */}
            {files.length > 0 && (
              <ul className="mt-3 space-y-2">
                {files.map((file, i) => (
                  <li
                    key={`${file.name}-${i}`}
                    className="flex items-center gap-3 rounded-lg border border-slate-100 dark:border-slate-800 p-2"
                  >
                    {isImageType(file.type, file.name) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={file.url}
                        alt={file.name}
                        className="h-10 w-10 rounded object-cover shrink-0"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded bg-slate-100 dark:bg-slate-800 shrink-0">
                        <FileText className="h-5 w-5 text-slate-400" aria-hidden="true" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-300">
                        {file.name}
                      </p>
                      <p className="text-xs text-slate-400">{formatBytes(file.size)}</p>
                    </div>
                    {!disabled && (
                      <button
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        onClick={(e) => { e.stopPropagation(); removeFile(i) }}
                        className="rounded p-1 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {uploading && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400">
                <ImageIcon className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />
                Uploading…
              </p>
            )}
          </FormField>
        )
      }}
    />
  )
}
