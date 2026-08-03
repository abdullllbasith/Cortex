'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

type Node = {
  x: number
  y: number
  vx: number
  vy: number
  r: number
}

const NODE_COLOR = '91, 168, 160'
const LINK_COLOR = '61, 142, 135'
const MAX_DIST = 160
const MAX_DIST_SQ = MAX_DIST * MAX_DIST

function nodeCountForSize(w: number, h: number) {
  const area = w * h
  return Math.max(28, Math.min(70, Math.round(area / 18000)))
}

function createNodes(count: number, w: number, h: number): Node[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.35,
    vy: (Math.random() - 0.5) * 0.35,
    r: 1.2 + Math.random() * 1.6,
  }))
}

/** Abstract animated network of vertices + edges for the marketing hero. */
export function HeroNetworkCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let nodes: Node[] = []
    let w = 0
    let h = 0
    let dpr = 1

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = parent.clientWidth
      h = parent.clientHeight
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const count = nodeCountForSize(w, h)
      if (nodes.length !== count) {
        nodes = createNodes(count, w, h)
      } else {
        for (const n of nodes) {
          n.x = Math.min(w, Math.max(0, n.x))
          n.y = Math.min(h, Math.max(0, n.y))
        }
      }
    }

    const drawFrame = (moving: boolean) => {
      ctx.clearRect(0, 0, w, h)

      if (moving) {
        for (const n of nodes) {
          n.x += n.vx
          n.y += n.vy
          if (n.x < 0 || n.x > w) n.vx *= -1
          if (n.y < 0 || n.y > h) n.vy *= -1
          n.x = Math.min(w, Math.max(0, n.x))
          n.y = Math.min(h, Math.max(0, n.y))
        }
      }

      // Edges
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const distSq = dx * dx + dy * dy
          if (distSq > MAX_DIST_SQ) continue
          const t = 1 - Math.sqrt(distSq) / MAX_DIST
          ctx.beginPath()
          ctx.strokeStyle = `rgba(${LINK_COLOR}, ${0.08 + t * 0.22})`
          ctx.lineWidth = 0.8 + t * 0.6
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
        }
      }

      // Vertices
      for (const n of nodes) {
        ctx.beginPath()
        ctx.fillStyle = `rgba(${NODE_COLOR}, 0.45)`
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fill()

        ctx.beginPath()
        ctx.fillStyle = `rgba(${NODE_COLOR}, 0.12)`
        ctx.arc(n.x, n.y, n.r * 3.2, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const loop = () => {
      drawFrame(true)
      raf = window.requestAnimationFrame(loop)
    }

    resize()
    drawFrame(false)

    if (!reduceMotion) {
      raf = window.requestAnimationFrame(loop)
    }

    const onResize = () => {
      resize()
      if (reduceMotion) drawFrame(false)
    }

    window.addEventListener('resize', onResize)

    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={cn(
        'pointer-events-none absolute inset-0 z-[1] opacity-70 dark:opacity-50',
        className,
      )}
      aria-hidden="true"
    />
  )
}
