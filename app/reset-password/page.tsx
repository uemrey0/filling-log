import { ResetPasswordForm } from './reset-password-form'

type ResetPasswordPageProps = {
  searchParams?: Promise<{
    token?: string
    error?: string
    username?: string
  }>
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams
  return (
    <ResetPasswordForm
      token={params?.token ?? ''}
      error={params?.error ?? ''}
      username={params?.username ?? ''}
    />
  )
}
