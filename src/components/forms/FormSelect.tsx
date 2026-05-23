'use client'

import { Controller, useFormContext, type FieldPath, type FieldValues } from 'react-hook-form'
import { SelectField, type SelectData } from '@/components/ui/Select'
import { FormField } from './FormField'

export interface FormSelectProps<T extends FieldValues> {
  name: FieldPath<T>
  data: SelectData
  label?: string
  helperText?: string
  required?: boolean
  placeholder?: string
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function FormSelect<T extends FieldValues>({
  name,
  data,
  label,
  helperText,
  required,
  placeholder,
  disabled,
  size,
}: FormSelectProps<T>) {
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
          <SelectField
            data={data}
            value={field.value ?? ''}
            onValueChange={field.onChange}
            placeholder={placeholder}
            disabled={disabled}
            size={size}
            error={fieldState.error?.message}
          />
        </FormField>
      )}
    />
  )
}
