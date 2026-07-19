export async function fetchMe() {
  const res = await fetch('/api/me', { credentials: 'include' })
  if (res.status === 401) return null
  if (!res.ok) throw new Error(`Failed to load profile (${res.status})`)
  const data = await res.json()
  return data.user
}

export async function logout() {
  const res = await fetch('/auth/logout', {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Logout failed')
  const data = await res.json()
  return data.logout_url
}
