'use client'

import { Controller, useFormContext, type FieldPath, type FieldValues } from 'react-hook-form'
import { Input, type InputProps } from '@/components/ui/Input'
import { FormField } from './FormField'

export interface FormInputProps<T extends FieldValues>
  extends Omit<InputProps, 'name' | 'value' | 'defaultValue' | 'onChange' | 'error'> {
  name: FieldPath<T>
  label?: string
  helperText?: string
  required?: boolean
}

export function FormInput<T extends FieldValues>({
  name,
  label,
  helperText,
  required,
  ...inputProps
}: FormInputProps<T>) {
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
          <Input
            {...field}
            {...inputProps}
            value={field.value ?? ''}
            error={fieldState.error?.message}
            showErrorMessage={false}
          />
        </FormField>
      )}
    />
  )
}
