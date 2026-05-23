import type { Metadata } from 'next'
import { LoginForm } from '@/components/auth'

export const metadata: Metadata = { title: 'Sign In' }

export default function LoginPage() {
  return <LoginForm />
}
