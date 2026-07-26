import { useEffect, useState } from 'react'
import { signedUrl } from '../lib/supabase'

export default function ItemImage({ path, alt, className, align = 'top' }: { path: string | null; alt: string; className?: string; align?: 'top' | 'center' }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    if (path) signedUrl(path).then(u => live && setUrl(u))
    return () => { live = false }
  }, [path])

  if (!path) return <div className={`${className} flex items-center justify-center bg-paper-deep text-ink-faint`}>no image</div>
  if (!url) return <div className={`${className} animate-pulse bg-paper-deep`} />
  return <img src={url} alt={alt} className={`${className} ${align === 'top' ? 'object-top' : ''} object-cover`} loading="lazy" />
}
