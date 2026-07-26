import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(url, anonKey)

// In-memory signed URL cache (private bucket; 1h expiry, refresh at 50m)
const signedCache = new Map<string, { url: string; exp: number }>()

export async function signedUrl(path: string): Promise<string | null> {
  const hit = signedCache.get(path)
  if (hit && hit.exp > Date.now()) return hit.url
  const { data, error } = await supabase.storage.from('inspiration').createSignedUrl(path, 3600)
  if (error || !data) return null
  signedCache.set(path, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 })
  return data.signedUrl
}
