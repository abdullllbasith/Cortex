'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from './Button'

interface Props {
  children: ReactNode
  /** Custom fallback — receives error + reset fn */
  fallback?: (error: Error, reset: () => void) => ReactNode
  /** Called on error (e.g. to send to Sentry) */
  onError?: (error: Error, info: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  showDetails: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, showDetails: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info)
    if (process.env.NODE_ENV === 'development') {
      console.error('[ErrorBoundary]', error, info)
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null, showDetails: false })
  }

  toggleDetails = () => {
    this.setState((s) => ({ showDetails: !s.showDetails }))
  }

  render() {
    const { hasError, error, showDetails } = this.state
    const { children, fallback } = this.props

    if (!hasError || !error) return children

    if (fallback) return fallback(error, this.reset)

    const isDev = process.env.NODE_ENV === 'development'

    return (
      <div
        role="alert"
        aria-live="assertive"
        className="flex min-h-[240px] flex-col items-center justify-center gap-6 rounded-xl border border-red-100 bg-red-50/50 p-8 text-center dark:border-red-900/40 dark:bg-red-950/20"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
          <AlertTriangle
            className="h-7 w-7 text-red-600 dark:text-red-400"
            aria-hidden="true"
          />
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Something went wrong
          </h2>
          <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
            {isDev
              ? error.message
              : 'An unexpected error occurred. Please try again or contact support if the problem persists.'}
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <Button
            size="sm"
            variant="danger"
            leftIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
            onClick={this.reset}
          >
            Try again
          </Button>

          {isDev && (
            <button
              type="button"
              onClick={this.toggleDetails}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              {showDetails ? (
                <>
                  <ChevronUp className="h-3 w-3" aria-hidden="true" />
                  Hide stack trace
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" aria-hidden="true" />
                  Show stack trace
                </>
              )}
            </button>
          )}
        </div>

        {isDev && showDetails && error.stack && (
          <pre className="w-full max-w-2xl overflow-x-auto rounded-lg border border-red-200 bg-white p-4 text-left text-xs text-red-700 dark:border-red-800 dark:bg-slate-950 dark:text-red-400">
            {error.stack}
          </pre>
        )}
      </div>
    )
  }
}

/**
 * Hook-friendly wrapper — wraps children with ErrorBoundary.
 *
 * @example
 * <WithErrorBoundary onError={Sentry.captureException}>
 *   <MyWidget />
 * </WithErrorBoundary>
 */
export function WithErrorBoundary({
  children,
  fallback,
  onError,
}: {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
  onError?: (error: Error, info: ErrorInfo) => void
}) {
  return (
    <ErrorBoundary fallback={fallback} onError={onError}>
      {children}
    </ErrorBoundary>
  )
}
