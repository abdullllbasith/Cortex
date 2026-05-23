'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { Controller, useFormContext, type FieldPath, type FieldValues } from 'react-hook-form'
import { Bold, Italic, List, ListOrdered, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FormField } from './FormField'

export interface FormRichTextProps<T extends FieldValues> {
  name: FieldPath<T>
  label?: string
  helperText?: string
  required?: boolean
  placeholder?: string
  disabled?: boolean
  minHeight?: number
}

function ToolbarButton({
  active,
  onClick,
  children,
  label,
}: {
  active?: boolean
  onClick: () => void
  children: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded transition-colors',
        active
          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-200',
      )}
    >
      {children}
    </button>
  )
}

export function FormRichText<T extends FieldValues>({
  name,
  label,
  helperText,
  required,
  placeholder = 'Write something…',
  disabled,
  minHeight = 120,
}: FormRichTextProps<T>) {
  const { control } = useFormContext<T>()

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <RichTextEditor
          value={field.value ?? ''}
          onChange={field.onChange}
          label={label}
          helperText={helperText}
          required={required}
          placeholder={placeholder}
          disabled={disabled}
          minHeight={minHeight}
          error={fieldState.error?.message}
          name={name}
        />
      )}
    />
  )
}

function RichTextEditor({
  value,
  onChange,
  label,
  helperText,
  required,
  placeholder,
  disabled,
  minHeight,
  error,
  name,
}: {
  value: string
  onChange: (html: string) => void
  label?: string
  helperText?: string
  required?: boolean
  placeholder?: string
  disabled?: boolean
  minHeight?: number
  error?: string
  name: string
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm max-w-none focus:outline-none px-3 py-2',
          'text-slate-900 dark:text-slate-100 dark:prose-invert',
        ),
        'data-placeholder': placeholder ?? '',
      },
    },
  })

  if (!editor) return null

  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Enter URL', prev ?? 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  return (
    <FormField
      name={name}
      label={label}
      helperText={helperText}
      required={required}
      error={error}
    >
      <div
        className={cn(
          'rounded-md border overflow-hidden',
          error
            ? 'border-red-500'
            : 'border-slate-200 dark:border-slate-700',
          disabled && 'opacity-50 pointer-events-none',
        )}
      >
        {/* Toolbar */}
        <div className="flex items-center gap-0.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 px-2 py-1">
          <ToolbarButton
            label="Bold"
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="h-3.5 w-3.5" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton
            label="Italic"
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="h-3.5 w-3.5" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton
            label="Bullet list"
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="h-3.5 w-3.5" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton
            label="Ordered list"
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="h-3.5 w-3.5" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton
            label="Link"
            active={editor.isActive('link')}
            onClick={setLink}
          >
            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
          </ToolbarButton>
        </div>

        {/* Editor */}
        <div style={{ minHeight }} className="bg-white dark:bg-slate-900">
          <EditorContent editor={editor} />
        </div>
      </div>
    </FormField>
  )
}
