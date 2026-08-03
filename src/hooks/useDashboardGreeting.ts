'use client'

import { useEffect, useState } from 'react'

export function useDashboardGreeting() {
  const [greeting, setGreeting] = useState('Good morning')
  const [dateStr, setDateStr] = useState('')

  useEffect(() => {
    const update = () => {
      const hour = new Date().getHours()
      setGreeting(
        hour < 12 ? 'Good morning'
        : hour < 17 ? 'Good afternoon'
        : 'Good evening',
      )
      setDateStr(
        new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      )
    }
    update()
    const timer = setInterval(update, 60_000)
    return () => clearInterval(timer)
  }, [])

  return { greeting, dateStr }
}
