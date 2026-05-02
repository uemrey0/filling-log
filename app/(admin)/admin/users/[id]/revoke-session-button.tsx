'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { revokeSession } from './session-actions'

export function RevokeSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const revoke = async () => {
    setLoading(true)
    try {
      await revokeSession(sessionId)
      toast.success('Session revoked')
      router.refresh()
    } catch {
      toast.error('Failed to revoke session')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void revoke()}
      disabled={loading}
      className="text-xs font-semibold text-gray-400 transition-colors hover:text-red-600 disabled:opacity-40"
    >
      {loading ? 'Revoking…' : 'Revoke'}
    </button>
  )
}
