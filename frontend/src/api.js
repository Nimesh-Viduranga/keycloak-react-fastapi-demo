export async function fetchMe(accessToken) {
  const res = await fetch('/api/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
  if (res.status === 401) return null
  if (!res.ok) throw new Error(`Failed to load profile (${res.status})`)
  const data = await res.json()
  return data.user
}
