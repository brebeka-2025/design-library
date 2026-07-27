/**
 * Prepare an image for upload: if it's oversized (bytes or pixels), scale it
 * down and re-encode as WebP in memory. Keeps analysis under the vision-API
 * limits without the user ever resizing anything by hand.
 */
const MAX_BYTES = 3.5 * 1024 * 1024
const MAX_W = 1600
const MAX_H = 7000 // full-page captures are tall

export async function prepareImage(file: File | Blob): Promise<{ blob: Blob; ext: string; contentType: string }> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = bitmap

  const withinLimits = file.size <= MAX_BYTES && width <= MAX_W * 1.5 && height <= MAX_H
  if (withinLimits) {
    bitmap.close()
    const type = (file as File).type || 'image/png'
    const ext = type.includes('jpeg') ? 'jpg' : type.includes('webp') ? 'webp' : 'png'
    return { blob: file, ext, contentType: type }
  }

  const scale = Math.min(1, MAX_W / width, MAX_H / height)
  const w = Math.round(width * scale)
  const h = Math.round(height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  let quality = 0.88
  let blob = await toBlob(canvas, quality)
  while (blob.size > MAX_BYTES && quality > 0.5) {
    quality -= 0.12
    blob = await toBlob(canvas, quality)
  }
  return { blob, ext: 'webp', contentType: 'image/webp' }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Image encoding failed'))), 'image/webp', quality)
  })
}

/** Pull an image out of a paste event, if there is one. */
export function imageFromPaste(e: ClipboardEvent): File | null {
  for (const item of e.clipboardData?.items ?? []) {
    if (item.type.startsWith('image/')) {
      return item.getAsFile()
    }
  }
  return null
}
