'use client'

import { useCallback, useState } from 'react'
import Image from 'next/image'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { Button, toast } from '@/components/ui'
import { cn } from '@/lib/utils'
import { authFetch } from '@/lib/api/apiClient'

interface ProductImageUploadProps {
  productId: string
  imageUrls: string[]
  onChange: (urls: string[]) => void
  disabled?: boolean
}

export function ProductImageUpload({
  productId,
  imageUrls,
  onChange,
  disabled = false,
}: ProductImageUploadProps) {
  const [uploading, setUploading] = useState(false)

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
      if (!list.length) {
        toast.error('Please select image files')
        return
      }

      setUploading(true)
      const next = [...imageUrls]

      try {
        for (const file of list) {
          const form = new FormData()
          form.append('file', file)
          form.append('bucket', process.env.NEXT_PUBLIC_SUPABASE_UPLOAD_BUCKET ?? 'uploads')
          form.append('path', `products/${productId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`)

          const res = await authFetch('/api/storage/upload', {
            method: 'POST',
            body: form,
            credentials: 'include',
          })
          const json = await res.json()
          if (!json.success || !json.data?.publicUrl) {
            throw new Error(json.error?.message ?? 'Upload failed')
          }
          next.push(json.data.publicUrl as string)
        }
        onChange(next)
        toast.success(`${list.length} image(s) uploaded`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Image upload failed')
      } finally {
        setUploading(false)
      }
    },
    [imageUrls, onChange, productId],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (disabled || uploading) return
      if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files)
    },
    [disabled, uploadFiles, uploading],
  )

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className={cn(
          'flex min-h-[120px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 px-4 py-6 text-center dark:border-slate-700',
          disabled && 'opacity-50 pointer-events-none',
        )}
      >
        {uploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        ) : (
          <>
            <ImagePlus className="mb-2 h-6 w-6 text-slate-400" />
            <p className="text-sm text-slate-500">Drag images here or</p>
            <label className="mt-2 cursor-pointer">
              <span className="text-sm font-medium text-indigo-600 hover:underline">browse files</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) void uploadFiles(e.target.files)
                  e.target.value = ''
                }}
              />
            </label>
          </>
        )}
      </div>

      {imageUrls.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {imageUrls.map((url, idx) => (
            <div key={`${url}-${idx}`} className="group relative aspect-square overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
              <Image src={url} alt="" fill className="object-cover" unoptimized />
              <button
                type="button"
                className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                onClick={() => onChange(imageUrls.filter((_, i) => i !== idx))}
                aria-label="Remove image"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
