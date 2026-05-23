'use client'

import { Controller, useFormContext, type FieldPath, type FieldValues } from 'react-hook-form'
import { Checkbox, type CheckboxProps } from '@/components/ui/Checkbox'

export interface FormCheckboxProps<T extends FieldValues>
  extends Omit<CheckboxProps, 'name' | 'checked' | 'onCheckedChange'> {
  name: FieldPath<T>
}

export function FormCheckbox<T extends FieldValues>({
  name,
  label,
  description,
  ...props
}: FormCheckboxProps<T>) {
  const { control } = useFormContext<T>()

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Checkbox
          {...props}
          id={name}
          label={label}
          description={description}
          checked={Boolean(field.value)}
          onCheckedChange={field.onChange}
          error={fieldState.error?.message}
        />
      )}
    />
  )
}
