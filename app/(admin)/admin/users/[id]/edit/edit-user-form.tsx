'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { updateUser } from './actions'

type EditUserFormProps = {
  userId: string
  initialName: string
  initialEmail: string
  initialUsername: string
}

export function EditUserForm({ userId, initialName, initialEmail, initialUsername }: EditUserFormProps) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState(initialEmail)
  const [username, setUsername] = useState(initialUsername)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!name.trim() || !email.trim() || !username.trim()) {
      toast.error('All fields are required.')
      return
    }

    setSaving(true)
    try {
      await updateUser(userId, { name, email, username })
      toast.success('User updated')
      router.push(`/admin/users/${userId}`)
    } catch {
      toast.error('Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card padding="lg">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
        />
        <Input
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="off"
          placeholder="username"
        />
        <div className="sm:col-span-2">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
          />
        </div>
      </div>

      <div className="mt-5 flex justify-end border-t border-gray-100 pt-5">
        <Button type="button" onClick={() => void save()} loading={saving} disabled={!name.trim() || !email.trim() || !username.trim()}>
          Save changes
        </Button>
      </div>
    </Card>
  )
}
