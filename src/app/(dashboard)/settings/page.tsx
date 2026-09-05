import { redirect } from 'next/navigation'

/** Default to profile — every role can open it (general requires SETTINGS_MANAGE). */
export default function SettingsIndexPage() {
  redirect('/settings/profile')
}
