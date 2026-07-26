import { supabase } from './supabase'

const SERVICE_URL = (import.meta.env.VITE_SERVICE_URL as string | undefined)?.replace(/\/$/, '')

async function authedFetch(path: string, body: unknown) {
  if (!SERVICE_URL) throw new Error('VITE_SERVICE_URL is not configured')
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not signed in')
  const res = await fetch(`${SERVICE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || `${path} failed (${res.status})`)
  return json
}

export function captureUrl(url: string): Promise<{ image_path: string; title: string; source_url: string }> {
  return authedFetch('/capture', { url })
}

export function analyzeItem(itemId: string): Promise<{ item: unknown }> {
  return authedFetch('/analyze', { item_id: itemId })
}
