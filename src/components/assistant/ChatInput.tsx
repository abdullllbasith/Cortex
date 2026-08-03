'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import { Send, Mic, MicOff, Paperclip, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'

interface ChatInputProps {
  onSend: (message: string) => void
  onTyping?: (isTyping: boolean) => void
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({
  onSend,
  onTyping,
  disabled = false,
  placeholder = 'Ask Cortex anything about your business…',
}: ChatInputProps) {
  const [value, setValue] = useState('')
  const [isListening, setIsListening] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    const maxHeight = 160
    el.style.height = '0px'
    const nextHeight = Math.min(el.scrollHeight, maxHeight)
    el.style.height = `${nextHeight}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [])

  useEffect(() => {
    adjustHeight()
  }, [value, adjustHeight])

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    onTyping?.(false)
    if (textareaRef.current) {
      textareaRef.current.style.height = '0px'
      textareaRef.current.style.overflowY = 'hidden'
    }
  }, [value, disabled, onSend, onTyping])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    onTyping?.(true)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => onTyping?.(false), 1500)
  }

  const toggleVoice = useCallback(() => {
    const SpeechRecognition =
      typeof window !== 'undefined'
        ? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
        : null

    if (!SpeechRecognition) return

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join('')
      setValue(transcript)
    }

    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [isListening])

  const handleFileAttach = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.doc,.docx,.txt,.csv,.xlsx'
    input.onchange = () => {
      const file = input.files?.[0]
      if (file) {
        setValue((prev) =>
          prev ? `${prev}\n[Attached: ${file.name}]` : `[Attached: ${file.name} — upload to Knowledge Engine pending]`,
        )
      }
    }
    input.click()
  }

  return (
    <div className="border-t border-slate-200 bg-white p-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-slate-700 dark:bg-slate-900 sm:p-4">
      <div className="mx-auto w-full max-w-4xl">
        <div
          className={cn(
            'chat-input-shell flex max-w-full items-end gap-1 overflow-hidden rounded-xl border border-slate-200 p-1.5 dark:border-slate-700',
            'bg-slate-50 dark:bg-slate-800/60',
            'focus-within:ring-2 focus-within:ring-indigo-500/25',
            'transition-shadow',
          )}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            rows={1}
            className={cn(
              'chat-input-field min-h-[44px] max-h-[160px] min-w-0 flex-1 resize-none overflow-hidden border-0 bg-transparent px-3 py-2.5',
              'text-base leading-5 text-slate-900 placeholder:text-slate-400 md:text-sm',
              'dark:text-slate-100',
              'outline-none shadow-none ring-0',
              'focus:border-0 focus:outline-none focus:ring-0 focus:shadow-none',
              'focus-visible:border-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          />

          <div className="flex h-10 items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={handleFileAttach}
              disabled={disabled}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              title="Attach file"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={toggleVoice}
              disabled={disabled}
              className={cn(
                'p-1.5 rounded-lg transition-colors disabled:opacity-50',
                isListening
                  ? 'text-red-500 bg-red-50 dark:bg-red-950/40'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700',
              )}
              title={isListening ? 'Stop listening' : 'Voice input'}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          </div>

          <Button
            onClick={handleSend}
            disabled={disabled || !value.trim()}
            className="shrink-0 h-10 w-10 p-0 rounded-lg"
            aria-label="Send message"
          >
            {disabled ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
      <p className="mt-2 hidden text-center text-xs text-slate-400 sm:block">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  )
}
