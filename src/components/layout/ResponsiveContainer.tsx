import { cn } from '@/lib/utils'

type ResponsiveContainerProps = {
  children: React.ReactNode
  className?: string
  as?: 'div' | 'section' | 'main' | 'article'
}

/** Max-width page wrapper: px-4 (mobile) → px-6 (tablet) → px-8 (desktop). */
export function ResponsiveContainer({
  children,
  className,
  as: Tag = 'div',
}: ResponsiveContainerProps) {
  return (
    <Tag
      className={cn(
        'mx-auto w-full max-w-[1440px]',
        'px-4 md:px-6 lg:px-8',
        className,
      )}
    >
      {children}
    </Tag>
  )
}
