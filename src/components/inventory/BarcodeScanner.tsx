'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, ScanLine } from 'lucide-react'
import { Button, toast } from '@/components/ui'

export interface BarcodeScanResult {
  productId: string
  variantId?: string
  sku: string
  name: string
  barcode: string
}

interface BarcodeScannerProps {
  onScan: (result: BarcodeScanResult) => void
  className?: string
}

export function BarcodeScanner({ onScan, className }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [active, setActive] = useState(false)
  const [lastCode, setLastCode] = useState<string | null>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)
  const scanningRef = useRef(false)

  const lookup = useCallback(
    async (code: string) => {
      if (scanningRef.current || code === lastCode) return
      scanningRef.current = true
      setLastCode(code)
      try {
        const res = await fetch(`/api/inventory/products/barcode/${encodeURIComponent(code)}`, {
          credentials: 'include',
        })
        const json = await res.json()
        if (!json.success) {
          toast.error(`No product found for ${code}`)
          return
        }
        onScan(json.data as BarcodeScanResult)
        toast.success(`Scanned: ${json.data.name}`)
      } catch {
        toast.error('Barcode lookup failed')
      } finally {
        setTimeout(() => {
          scanningRef.current = false
        }, 1500)
      }
    },
    [lastCode, onScan],
  )

  const startScanner = useCallback(async () => {
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const reader = new BrowserMultiFormatReader()
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      const video = videoRef.current
      if (!video) {
        stream.getTracks().forEach((t) => t.stop())
        toast.error('Video element not ready')
        return
      }
      video.srcObject = stream
      await video.play()

      const controls = await reader.decodeFromStream(stream, video, (result) => {
        if (result) void lookup(result.getText())
      })

      controlsRef.current = {
        stop: () => {
          controls.stop()
          stream.getTracks().forEach((t) => t.stop())
        },
      }
      setActive(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Camera access denied')
    }
  }, [lookup])

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
    setActive(false)
  }, [])

  useEffect(() => () => stopScanner(), [stopScanner])

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-2">
        <ScanLine className="h-4 w-4 text-slate-500" />
        <span className="text-sm font-medium">Barcode Scanner</span>
        {!active ? (
          <Button type="button" variant="outline" size="sm" onClick={() => void startScanner()}>
            <Camera className="h-4 w-4 mr-1" /> Start camera
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={stopScanner}>
            <CameraOff className="h-4 w-4 mr-1" /> Stop
          </Button>
        )}
      </div>
      <div className="relative rounded-lg overflow-hidden bg-black aspect-video max-w-sm">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        {active && (
          <div className="absolute inset-0 border-2 border-indigo-400/60 m-8 rounded pointer-events-none" />
        )}
        {!active && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs">
            Camera off
          </div>
        )}
      </div>
      {lastCode && <p className="text-xs text-slate-500 mt-1 font-mono">Last: {lastCode}</p>}
    </div>
  )
}
