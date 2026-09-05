'use client'

import { useEffect } from 'react'

/**
 * Locks the document viewport while dashboard/admin shells are mounted so
 * overscroll never rubber-bands the browser chrome — only inner panes scroll.
 */
export function AppViewportLock() {
  useEffect(() => {
    const html = document.documentElement
    const body = document.body

    const prev = {
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      htmlHeight: html.style.height,
      bodyOverflow: body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
      bodyHeight: body.style.height,
      bodyMinHeight: body.style.minHeight,
    }

    html.style.overflow = 'hidden'
    html.style.overscrollBehavior = 'none'
    html.style.height = '100%'
    body.style.overflow = 'hidden'
    body.style.overscrollBehavior = 'none'
    body.style.height = '100%'
    body.style.minHeight = '0'

    return () => {
      html.style.overflow = prev.htmlOverflow
      html.style.overscrollBehavior = prev.htmlOverscroll
      html.style.height = prev.htmlHeight
      body.style.overflow = prev.bodyOverflow
      body.style.overscrollBehavior = prev.bodyOverscroll
      body.style.height = prev.bodyHeight
      body.style.minHeight = prev.bodyMinHeight
    }
  }, [])

  return null
}
