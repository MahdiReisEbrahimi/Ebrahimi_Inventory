const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const message = Array.isArray(body?.message) ? body.message[0] : body?.message
    throw new Error(typeof message === 'string' ? message : 'ارتباط با سرور ناموفق بود.')
  }
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>)
}
