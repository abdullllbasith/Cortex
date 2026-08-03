'use client'

import { Controller, useFormContext, type FieldPath, type FieldValues } from 'react-hook-form'
import { Toggle, type ToggleProps } from '@/components/ui/Toggle'

export interface FormToggleProps<T extends FieldValues>
  extends Omit<ToggleProps, 'name' | 'checked' | 'onCheckedChange'> {
  name: FieldPath<T>
}

export function FormToggle<T extends FieldValues>({
  name,
  label,
  description,
  size,
  ...props
}: FormToggleProps<T>) {
  const { control } = useFormContext<T>()

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Toggle
          {...props}
          id={name}
          label={label}
          description={description}
          size={size}
          checked={Boolean(field.value)}
          onCheckedChange={field.onChange}
        />
      )}
    />
  )
}
