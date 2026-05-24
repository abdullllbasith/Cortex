/** Server-safe validation messages — no react-hook-form imports */
export const FORM_MESSAGES = {
  required:     'This field is required.',
  email:        'Enter a valid email address.',
  phone:        'Enter a valid phone number.',
  url:          'Enter a valid URL.',
  slug:         'Use lowercase letters, numbers, and hyphens only.',
  currency:     'Enter a valid monetary amount.',
  percentage:   'Enter a value between 0 and 100.',
  minLength:    (n: number) => `Must be at least ${n} characters.`,
  maxLength:    (n: number) => `Must be no more than ${n} characters.`,
  min:          (n: number) => `Must be at least ${n}.`,
  max:          (n: number) => `Must be no more than ${n}.`,
  invalidDate:  'Enter a valid date.',
  dateRange:    'End date must be after start date.',
  fileTooLarge: (mb: number) => `File must be smaller than ${mb} MB.`,
  fileType:     'This file type is not allowed.',
} as const
