import JSZip from 'jszip'

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}

export function stamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export async function zipOutputs(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const zip = new JSZip()
  const used = new Set<string>()
  for (const f of files) {
    let name = f.name
    let n = 2
    while (used.has(name)) {
      const dot = f.name.lastIndexOf('.')
      name = dot > 0 ? `${f.name.slice(0, dot)}-${n}${f.name.slice(dot)}` : `${f.name}-${n}`
      n++
    }
    used.add(name)
    zip.file(name, f.blob)
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}

/** Parse "1-3, 5, 8-" into a de-duplicated list of 0-based page indices (order preserved). */
export function parsePages(spec: string, total: number): number[] {
  const out: number[] = []
  const push = (n: number) => {
    const i = n - 1
    if (i >= 0 && i < total && !out.includes(i)) out.push(i)
  }
  for (const raw of spec.split(/[,;\s]+/)) {
    const token = raw.trim()
    if (!token) continue
    const m = token.match(/^(\d+)?\s*[-–]\s*(\d+)?$/)
    if (m) {
      const a = m[1] ? parseInt(m[1], 10) : 1
      const b = m[2] ? parseInt(m[2], 10) : total
      const step = a <= b ? 1 : -1
      for (let n = a; step > 0 ? n <= b : n >= b; n += step) push(n)
    } else if (/^\d+$/.test(token)) {
      push(parseInt(token, 10))
    }
  }
  return out
}

/** Each comma-separated token becomes its own group. "1-3, 5" -> [[0,1,2],[4]] */
export function parsePageGroups(spec: string, total: number): number[][] {
  const groups: number[][] = []
  for (const raw of spec.split(',')) {
    const t = raw.trim()
    if (!t) continue
    const pages = parsePages(t, total)
    if (pages.length) groups.push(pages)
  }
  return groups.length ? groups : [parsePages(spec, total)].filter((g) => g.length)
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not encode the rendered page.'))),
      type,
      quality
    )
  })
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',')
  const head = dataUrl.slice(0, comma)
  const body = dataUrl.slice(comma + 1)
  const mime = /data:([^;]+)/.exec(head)?.[1] || 'application/octet-stream'
  const binary = atob(body)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('That image could not be decoded.'))
    img.src = src
  })
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function readErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/password/i.test(msg)) return 'This PDF is password-protected. Unlocking isn’t available yet — Docsy will not pretend it can break encryption.'
  if (/encrypted/i.test(msg)) return 'This PDF is encrypted, so it can’t be processed in the browser yet.'
  if (/Invalid PDF|no pdf|structure/i.test(msg)) return 'That file doesn’t look like a valid PDF. It may be damaged or not a PDF at all.'
  return msg || 'Something went wrong while processing the file.'
}
