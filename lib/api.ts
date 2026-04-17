const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? ''

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, init)
}
