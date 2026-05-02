export type AdminUser = {
  id: string
  name: string
  email: string
  emailVerified?: boolean | null
  username?: string | null
  displayUsername?: string | null
  role?: string | null
  banned?: boolean | null
  banReason?: string | null
  banExpires?: Date | string | null
  createdAt?: Date | string
  updatedAt?: Date | string
}

export function getUserUsername(user: AdminUser) {
  return user.displayUsername ?? user.username ?? '-'
}

export function formatAdminDate(value?: Date | string) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatAdminDateTime(value?: Date | string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function generateHiddenPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
  const bytes = new Uint32Array(18)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join('')
}
