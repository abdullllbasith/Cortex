'use client'

import { Controller, useFormContext, type FieldPath, type FieldValues } from 'react-hook-form'
import { Textarea, type TextareaProps } from '@/components/ui/Textarea'
import { FormField } from './FormField'

export interface FormTextareaProps<T extends FieldValues>
  extends Omit<TextareaProps, 'name' | 'value' | 'defaultValue' | 'onChange' | 'error'> {
  name: FieldPath<T>
  label?: string
  helperText?: string
  required?: boolean
}

export function FormTextarea<T extends FieldValues>({
  name,
  label,
  helperText,
  required,
  ...textareaProps
}: FormTextareaProps<T>) {
  const { control } = useFormContext<T>()

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <FormField
          name={name}
          label={label}
          helperText={helperText}
          required={required}
          error={fieldState.error?.message}
        >
          <Textarea
            {...field}
            {...textareaProps}
            value={field.value ?? ''}
            error={fieldState.error?.message}
            showErrorMessage={false}
          />
        </FormField>
      )}
    />
  )
}
