import { PDFDocument, StandardFonts, rgb, degrees, PDFName } from 'pdf-lib'
import {
  baseName,
  canvasToBlob,
  clamp,
  formatBytes,
  parsePageGroups,
  parsePages,
  stamp,
  zipOutputs,
} from './util'
import { extractPageLines, openPdf, renderPdfPage } from './pdfjs'

export type Opts = Record<string, any>
export interface OutFile {
  name: string
  blob: Blob
}
export interface PdfInfo {
  fileName: string
  fileSize: number
  pages: number
  encrypted: boolean
  hasText: boolean
  scanned: boolean
  title: string
  author: string
  creator: string
  producer: string
  created: string
  sizes: string[]
}
export interface RunResult {
  files: OutFile[]
  note?: string
  info?: PdfInfo
}
export type ProgressFn = (pct: number, label?: string) => void

export const PAGE_SIZES: Record<string, [number, number]> = {
  A4: [595.28, 841.89],
  A3: [841.89, 1190.55],
  A5: [419.53, 595.28],
  Letter: [612, 792],
  Legal: [612, 1008],
  Tabloid: [792, 1224],
}

const tick = () => new Promise((r) => setTimeout(r, 0))

function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return rgb(0.5, 0.5, 0.5)
  const n = parseInt(m[1], 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

async function pdfBlob(doc: PDFDocument, name: string): Promise<OutFile> {
  const bytes = await doc.save({ useObjectStreams: true })
  return { name, blob: new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' }) }
}

async function load(file: File): Promise<PDFDocument> {
  return PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: false })
}

/* ────────────────────────────── merge / split ───────────────────────────── */

export async function mergePdfs(files: File[], o: Opts = {}, onProgress?: ProgressFn): Promise<RunResult> {
  if (files.length < 2) throw new Error('Add at least two PDFs to merge — or use another tool for a single file.')
  const out = await PDFDocument.create()
  for (let i = 0; i < files.length; i++) {
    const doc = await load(files[i])
    const pages = await out.copyPages(doc, doc.getPageIndices())
    pages.forEach((p) => out.addPage(p))
    onProgress?.(((i + 1) / files.length) * 100, `Merging ${files[i].name}`)
    await tick()
  }
  out.setCreator('Docsy')
  out.setProducer('Docsy')
  const name = `${o.fileName?.trim() || 'docsy-merged'}.pdf`
  return {
    files: [await pdfBlob(out, name)],
    note: `${files.length} files combined. Nothing left this device.`,
  }
}

export async function splitPdf(file: File, o: Opts, onProgress?: ProgressFn): Promise<RunResult> {
  const src = await load(file)
  const total = src.getPageCount()
  const mode = o.mode || 'extract'
  const ranges = String(o.ranges || '').trim()
  const base = baseName(file.name)
  const outputs: OutFile[] = []

  if (mode === 'each') {
    for (let i = 0; i < total; i++) {
      const out = await PDFDocument.create()
      const [p] = await out.copyPages(src, [i])
      out.addPage(p)
      outputs.push(await pdfBlob(out, `${base}-page-${String(i + 1).padStart(3, '0')}.pdf`))
      onProgress?.(((i + 1) / total) * 100, `Page ${i + 1} of ${total}`)
      await tick()
    }
  } else if (mode === 'ranges') {
    const groups = parsePageGroups(ranges || '1', total)
    for (let g = 0; g < groups.length; g++) {
      const out = await PDFDocument.create()
      const pages = await out.copyPages(src, groups[g])
      pages.forEach((p) => out.addPage(p))
      const label = g + 1
      outputs.push(await pdfBlob(out, `${base}-part-${String(label).padStart(2, '0')}.pdf`))
      onProgress?.(((g + 1) / groups.length) * 100)
      await tick()
    }
  } else {
    const picked = parsePages(ranges, total)
    if (!picked.length) throw new Error('Enter at least one page, e.g. 1-3, 5.')
    const out = await PDFDocument.create()
    const pages = await out.copyPages(src, picked)
    pages.forEach((p) => out.addPage(p))
    outputs.push(await pdfBlob(out, `${base}-extracted.pdf`))
  }

  return {
    files: outputs,
    note:
      mode === 'each'
        ? `One PDF per page (${outputs.length}). Downloading as a ZIP.`
        : mode === 'ranges'
          ? `Split into ${outputs.length} files. Downloading as a ZIP.`
          : `${outputs[0] ? 'Pages extracted' : 'No pages selected'}.`,
  }
}

/* ─────────────────────────────── organizing ─────────────────────────────── */

export async function exportOrganized(
  file: File,
  pages: { index: number; rotation: number }[],
  onProgress?: ProgressFn
): Promise<RunResult> {
  if (!pages.length) throw new Error('Keep at least one page before exporting.')
  const src = await load(file)
  const out = await PDFDocument.create()
  for (let i = 0; i < pages.length; i++) {
    const entry = pages[i]
    const [p] = await out.copyPages(src, [entry.index])
    p.setRotation(degrees(entry.rotation % 360))
    out.addPage(p)
    onProgress?.(((i + 1) / pages.length) * 100)
    await tick()
  }
  out.setCreator('Docsy')
  out.setProducer('Docsy')
  return {
    files: [await pdfBlob(out, `${baseName(file.name)}-organized.pdf`)],
    note: `${pages.length} pages exported in your order.`,
  }
}

export async function rotatePdf(file: File, o: Opts, onProgress?: ProgressFn): Promise<RunResult> {
  const src = await load(file)
  const total = src.getPageCount()
  const angle = Number(o.angle ?? 90)
  const targets = String(o.pages || '').trim()
  const indices = targets ? parsePages(targets, total) : src.getPageIndices()
  if (!indices.length) throw new Error('No pages matched that range.')
  indices.forEach((idx) => {
    const page = src.getPage(idx)
    page.setRotation(degrees((page.getRotation().angle + angle) % 360))
  })
  onProgress?.(100)
  return {
    files: [await pdfBlob(src, `${baseName(file.name)}-rotated.pdf`)],
    note: `${indices.length} page${indices.length === 1 ? '' : 's'} rotated ${angle}°.`,
  }
}

export async function removePages(file: File, o: Opts, onProgress?: ProgressFn): Promise<RunResult> {
  const src = await load(file)
  const total = src.getPageCount()
  const drop = new Set(parsePages(String(o.pages || ''), total))
  if (!drop.size) throw new Error('Enter the pages you want to remove, e.g. 2, 5-7.')
  if (drop.size >= total) throw new Error('That would remove every page. Keep at least one.')
  const keep = src.getPageIndices().filter((i) => !drop.has(i))
  const out = await PDFDocument.create()
  const copied = await out.copyPages(src, keep)
  copied.forEach((p) => out.addPage(p))
  onProgress?.(100)
  return {
    files: [await pdfBlob(out, `${baseName(file.name)}-pages-removed.pdf`)],
    note: `${drop.size} page${drop.size === 1 ? '' : 's'} removed.`,
  }
}

export async function extractPages(file: File, o: Opts, onProgress?: ProgressFn): Promise<RunResult> {
  const src = await load(file)
  const total = src.getPageCount()
  const keep = parsePages(String(o.pages || ''), total)
  if (!keep.length) throw new Error('Enter the pages you want to keep, e.g. 1-3, 8.')
  const out = await PDFDocument.create()
  const copied = await out.copyPages(src, keep)
  copied.forEach((p) => out.addPage(p))
  onProgress?.(100)
  return {
    files: [await pdfBlob(out, `${baseName(file.name)}-extracted.pdf`)],
    note: `${keep.length} page${keep.length === 1 ? '' : 's'} extracted.`,
  }
}

export async function duplicatePages(file: File, o: Opts, onProgress?: ProgressFn): Promise<RunResult> {
  const src = await load(file)
  const total = src.getPageCount()
  const dup = new Set(parsePages(String(o.pages || ''), total))
  const times = clamp(Number(o.times ?? 1), 1, 10)
  if (!dup.size) throw new Error('Choose which pages to duplicate.')
  const plan: number[] = []
  src.getPageIndices().forEach((i) => {
    plan.push(i)
    if (dup.has(i)) for (let t = 0; t < times; t++) plan.push(i)
  })
  const out = await PDFDocument.create()
  for (let i = 0; i < plan.length; i++) {
    const [p] = await out.copyPages(src, [plan[i]])
    out.addPage(p)
    if (i % 8 === 0) {
      onProgress?.((i / plan.length) * 100)
      await tick()
    }
  }
  onProgress?.(100)
  return {
    files: [await pdfBlob(out, `${baseName(file.name)}-duplicated.pdf`)],
    note: `Duplicated ${dup.size} page${dup.size === 1 ? '' : 's'} ×${times}.`,
  }
}

export async function addBlankPages(file: File, o: Opts, onProgress?: ProgressFn): Promise<RunResult> {
  const src = await load(file)
  const count = clamp(Number(o.count ?? 1), 1, 50)
  const position = o.position || 'end'
  const sizeName = o.size || 'match'
  const first = src.getPage(0).getSize()
  const size: [number, number] = sizeName === 'match' ? [first.width, first.height] : PAGE_SIZES[sizeName] || PAGE_SIZES.A4
  let at = src.getPageCount()
  if (position === 'start') at = 0
  if (position === 'after') at = clamp(Number(o.afterPage ?? 1), 1, src.getPageCount())
  for (let i = 0; i < count; i++) src.insertPage(at + i, size)
  onProgress?.(100)
  return {
    files: [await pdfBlob(src, `${baseName(file.name)}-blank-pages.pdf`)],
    note: `${count} blank page${count === 1 ? '' : 's'} added.`,
  }
}

export async function cropPdf(file: File, o: Opts, onProgress?: ProgressFn): Promise<RunResult> {
  const src = await load(file)
  const unit = o.unit || 'mm'
  const factor = unit === '%' ? 0 : unit === 'mm' ? 2.834645 : 1
  const margins = {
    top: Number(o.top ?? 10) * factor,
    right: Number(o.right ?? 10) * factor,
    bottom: Number(o.bottom ?? 10) * factor,
    left: Number(o.left ?? 10) * factor,
  }
  src.getPages().forEach((page) => {
    const { width, height } = page.getSize()
    let { top, right, bottom, left } = margins
    if (unit === '%') {
      top = (Number(o.top ?? 5) / 100) * height
      bottom = (Number(o.bottom ?? 5) / 100) * height
      left = (Number(o.left ?? 5) / 100) * width
      right = (Number(o.right ?? 5) / 100) * width
    }
    const w = Math.max(18, width - left - right)
    const h = Math.max(18, height - top - bottom)
    page.setCropBox(left, bottom, w, h)
  })
  onProgress?.(100)
  return {
    files: [await pdfBlob(src, `${baseName(file.name)}-cropped.pdf`)],
    note: 'Crop box changed. Cropping is non-destructive — the hidden content still exists inside the file.',
  }
}

/* ─────────────────────────────── rendering ──────────────────────────────── */

async function renderAll(
  file: File,
  scale: number,
  onProgress: ProgressFn | undefined,
  filter?: (ctx: CanvasRenderingContext2D) => void
): Promise<{ canvases: HTMLCanvasElement[]; doc: Awaited<ReturnType<typeof openPdf>> }> {
  const doc = await openPdf(await file.arrayBuffer())
  const canvases: HTMLCanvasElement[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const { canvas } = await renderPdfPage(doc, i, scale)
    if (filter) {
      const ctx = canvas.getContext('2d')
      if (ctx) filter(ctx)
    }
    canvases.push(canvas)
    onProgress?.((i / doc.numPages) * 100, `Rendering page ${i} of ${doc.numPages}`)
    await tick()
  }
  return { canvases, doc }
}

async function imagesToPdfDoc(
  canvases: HTMLCanvasElement[],
  quality: number,
  onProgress?: ProgressFn
): Promise<PDFDocument> {
  const out = await PDFDocument.create()
  for (let i = 0; i < canvases.length; i++) {
    const canvas = canvases[i]
    const blob = await canvasToBlob(canvas, 'image/jpeg', quality)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const img = await out.embedJpg(bytes)
    const w = canvas.width
    const h = canvas.height
    const page = out.addPage([w, h])
    page.drawImage(img, { x: 0, y: 0, width: w, height: h })
    onProgress?.(((i + 1) / canvases.length) * 100, 'Rebuilding pages')
    await tick()
  }
  return out
}

export async function compressPdf(file: File, o: Opts, onProgress?: ProgressFn): Promise<RunResult> {
  const quality = clamp(Number(o.quality ?? 72) / 100, 0.2, 1)
  const scale = clamp(Number(o.scale ?? 1.5), 0.6, 3)
  const { canvases } = await renderAll(file, scale, (p, l) => onProgress?.(p * 0.8, l))
  const out = await imagesToPdfDoc(canvases, quality, (p) => onProgress?.(80 + p * 0.2))
  out.setCreator('Docsy')
  out.setProducer('Docsy')
  const result = await pdfBlob(out, `${baseName(file.name)}-compressed.pdf`)
  const saved = file.size - result.blob.size
  if (saved <= 0) {
    const original: OutFile = {
      name: `${baseName(file.name)}-compressed.pdf`,
      blob: file.slice(0, file.size, file.type || 'application/pdf'),
    }
    return {
      files: [original],
      note: 'This file is already lean. Re-rendering would have made it bigger, so Docsy returned it untouched rather than waste your quality.',
    }
  }
  return {
    files: [result],
    note: `Saved ${formatBytes(saved)} (${Math.round((saved / file.size) * 100)}%). Pages were re-rendered as images, so text is no longer selectable — that is the trade-off, stated honestly.`,
  }
}

export async function flattenPdf(file: File, o: Opts, onProgress?: ProgressFn): Promise<RunResult> {
  const scale = clamp(Number(o.dpi ?? 150) / 72, 1, 4)
  const { canvases } = await renderAll(file, scale, (p, l) => onProgress?.(p * 0.8, l))
  const out = await imagesToPdfDoc(canvases, 0.92, (p) => onProgress?.(80 + p * 0.2))
  return {
    files: [await pdfBlob(out, `${baseName(file.name)}-flattened.pdf`)],
    note: 'Everything is now ink on a page: forms, annotations and links are baked in. Text is no longer selectable and links stop working.',
  }
}

export async function recolorPdf(file: File, o: Opts, onProgress?: ProgressFn): Promise<RunResult> {
  const mode = o.mode || 'invert'
  const filter =
    mode === 'grayscale'
      ? (ctx: CanvasRenderingContext2D) => {
          const img = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
          const d = img.data
          for (let i = 0; i < d.length; i += 4) {
            const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
            d[i] = d[i + 1] = d[i + 2] = v
          }
          ctx.putImageData(img, 0, 0)
        }
      : (ctx: CanvasRenderingContext2D) => {
          const img = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
          const d = img.data
          for (let i = 0; i < d.length; i += 4) {
            d[i] = 255 - d[i]
            d[i + 1] = 255 - d[i + 1]
            d[i + 2] = 255 - d[i + 2]
          }
          ctx.putImageData(img, 0, 0)
        }
  const { canvases } = await renderAll(file, 1.6, (p, l) => onProgress?.(p * 0.8, l), filter)
  const out = await imagesToPdfDoc(canvases, 0.9, (p) => onProgress?.(80 + p * 0.2))
  return {
    files: [await pdfBlob(out, `${baseName(file.name)}-${mode}.pdf`)],
    note: 'Pages were re-rendered. Text becomes an image, but the look is exactly what you see.',
  }
}

export async function resizePdf(file: File, o: Opts, onProgress?: ProgressFn): Promise<RunResult> {
  const target = PAGE_SIZES[o.size || 'A4'] || PAGE_SIZES.A4
  const landscape = o.orientation === 'landscape'
  const [pw, ph] = landscape ? [target[1], target[0]] : target
  const fitMode = o.fit || 'contain'
  const { canvases } = await renderAll(file, 2, (p, l) => onProgress?.(p * 0.75, l))
  const out = await PDFDocument.create()
  for (let i = 0; i < canvases.length; i++) {
    const c = canvases[i]
    const blob = await canvasToBlob(c, 'image/jpeg', 0.9)
    const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()))
    const page = out.addPage([pw, ph])
    if (fitMode === 'stretch') {
      page.drawImage(img, { x: 0, y: 0, width: pw, height: ph })
    } else {
      const r = Math.min(pw / c.width, ph / c.height)
      const w = c.width * r
      const h = c.height * r
      page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h })
    }
    onProgress?.(75 + ((i + 1) / canvases.length) * 25)
    await tick()
  }
  return {
    files: [await pdfBlob(out, `${baseName(file.name)}-${o.size || 'A4'}.pdf`)],
    note: 'Pages were re-rendered at the new size. Text is rasterised as part of resizing.',
  }
}

export async function contactSheet(file: File, o: Opts, onProgress?: ProgressFn): Promise<RunResult> {
  const doc = await openPdf(await file.arrayBuffer())
  const cols = clamp(Number(o.columns ?? 4), 2, 6)
  const rows = clamp(Number(o.rows ?? 5), 2, 8)
  const sheetSize: [number, number] = [595.28, 841.89]
  const margin = 28
  const gap = 12
  const labelH = 14
  const cellW = (sheetSize[0] - margin * 2 - gap * (cols - 1)) / cols
  const cellH = (sheetSize[1] - margin * 2 - gap * (rows - 1)) / rows
  const out = await PDFDocument.create()
  const font = await out.embedFont(StandardFonts.Helvetica)
  let page: any = null
  let slot = 0

  for (let i = 1; i <= doc.numPages; i++) {
    const { canvas } = await renderPdfPage(doc, i, 1.2)
    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.82)
    const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()))
    if (!page || slot >= cols * rows) {
      page = out.addPage(sheetSize)
      slot = 0
    }
    const col = slot % cols
    const row = Math.floor(slot / cols)
    const x = margin + col * (cellW + gap)
    const yTop = sheetSize[1] - margin - row * (cellH + gap)
    const availW = cellW
    const availH = cellH - labelH
    const r = Math.min(availW / canvas.width, availH / canvas.height)
    const w = canvas.width * r
    const h = canvas.height * r
    page.drawImage(img, { x: x + (availW - w) / 2, y: yTop - h, width: w, height: h })
    page.drawText(String(i), { x, y: yTop - cellH + 2, size: 8, font, color: rgb(0.45, 0.45, 0.45) })
    slot++
    onProgress?.((i / doc.numPages) * 100, `Thumbnail ${i} of ${doc.numPages}`)
    await tick()
  }
  return {
    files: [await pdfBlob(out, `${baseName(file.name)}-contact-sheet.pdf`)],
    note: `${doc.numPages} pages arranged ${cols}×${rows} per sheet.`,
  }
}

export async function pdfToImages(file: File, o: Opts, onProgress?: ProgressFn): Promise<RunResult> {
  const format = o.format || 'png'
  const dpi = clamp(Number(o.dpi ?? 150), 48, 400)
  const doc = await openPdf(await file.arrayBuffer())
  const scale = dpi / 72
  const mime = format === 'jpg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png'
  const outputs: OutFile[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const { canvas } = await renderPdfPage(doc, i, scale)
    const blob = await canvasToBlob(canvas, mime, format === 'png' ? undefined : 0.9)
    const actual =
      blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'
    outputs.push({ name: `${baseName(file.name)}-page-${String(i).padStart(3, '0')}.${actual}`, blob })
    onProgress?.((i / doc.numPages) * 100, `Page ${i} of ${doc.numPages}`)
    await tick()
  }
  return {
    files: outputs,
    note: `${outputs.length} image${outputs.length === 1 ? '' : 's'} at ${dpi} DPI. Downloading as a ZIP.`,
  }
}

export async function imagesToPdf(files: File[], o: Opts, onProgress?: ProgressFn): Promise<RunResult> {
  if (!files.length) throw new Error('Add at least one image.')
  const out = await PDFDocument.create()
  const sizeName = o.size || 'A4'
  const orientation = o.orientation || 'auto'
  const margin = clamp(Number(o.margin ?? 0), 0, 100)
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    let bitmap: ImageBitmap
    try {
      bitmap = await createImageBitmap(file)
    } catch {
      throw new Error(`“${file.name}” could not be decoded by this browser.`)
    }
    const scale = Math.min(1, 3600 / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()
    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92)
    const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()))

    if (sizeName === 'fit') {
      const ptW = (w * 72) / 96
      const ptH = (h * 72) / 96
      const page = out.addPage([ptW, ptH])
      page.drawImage(img, { x: 0, y: 0, width: ptW, height: ptH })
    } else {
      const base = PAGE_SIZES[sizeName] || PAGE_SIZES.A4
      const isLandscape =
        orientation === 'landscape' || (orientation === 'auto' && w > h)
      const [pw, ph] = isLandscape ? [base[1], base[0]] : base
      const page = out.addPage([pw, ph])
      const availW = Math.max(1, pw - margin * 2)
      const availH = Math.max(1, ph - margin * 2)
      const r = Math.min(availW / w, availH / h)
      const dw = w * r
      const dh = h * r
      page.drawImage(img, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh })
    }
    onProgress?.(((i + 1) / files.length) * 100, `Adding ${file.name}`)
    await tick()
  }
  out.setCreator('Docsy')
  out.setProducer('Docsy')
  return {
    files: [await pdfBlob(out, `${o.fileName?.trim() || 'docsy-images'}.pdf`)],
    note: `${files.length} image${files.length === 1 ? '' : 's'} combined into one PDF.`,
  }
}

/* ─────────────────────────────── text tools ─────────────────────────────── */

export async function pdfToText(file: File, onProgress?: ProgressFn): Promise<RunResult> {
  const doc = await openPdf(await file.arrayBuffer())
  const chunks: string[] = []
  let chars = 0
  for (let i = 1; i <= doc.numPages; i++) {
    const lines = await extractPageLines(doc, i)
    const pageText = lines.map((l) => l.text).join('\n')
    chars += pageText.replace(/\s/g, '').length
    chunks.push(`— Page ${i} —\n${pageText}`)
    onProgress?.((i / doc.numPages) * 100, `Reading page ${i} of ${doc.numPages}`)
    await tick()
  }
  if (chars === 0) {
    throw new Error(
      'No selectable text found. This looks like a scanned PDF — Docsy has no fake short-cut here. OCR arrives in a later build.'
    )
  }
  const text = chunks.join('\n\n')
  return {
    files: [{ name: `${baseName(file.name)}.txt`, blob: new Blob([text], { type: 'text/plain;charset=utf-8' }) }],
    note: `${chars.toLocaleString()} characters of real, selectable text extracted.`,
  }
}

function sanitizeForStandardFont(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014\u2015]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u2022\u25CF\u25AA]/g, '-')
    .replace(/\t/g, '    ')
    .replace(/[^\x00-\xFF\n]/g, '?')
}

export async function textToPdf(o: Opts, onProgress?: ProgressFn): Promise<RunResult> {
  const raw = String(o.text || '').trim()
  if (!raw) throw new Error('Type or paste some text first.')
  const sizeName = o.size || 'A4'
  const base = PAGE_SIZES[sizeName] || PAGE_SIZES.A4
  const landscape = o.orientation === 'landscape'
  const [pw, ph] = landscape ? [base[1], base[0]] : base
  const margin = 54
  const fontSize = clamp(Number(o.fontSize ?? 12), 7, 30)
  const lineGap = fontSize * 0.55
  const leading = fontSize + lineGap
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const maxWidth = pw - margin * 2

  let page = doc.addPage([pw, ph])
  let y = ph - margin
  let pageCount = 1

  const writeLine = async (text: string, useBold = false) => {
    if (y < margin + leading) {
      page = doc.addPage([pw, ph])
      pageCount++
      y = ph - margin
    }
    page.drawText(text, { x: margin, y, size: fontSize, font: useBold ? bold : font, color: rgb(0.08, 0.08, 0.09) })
    y -= leading
  }

  const paragraphs = sanitizeForStandardFont(raw).split('\n')
  for (const para of paragraphs) {
    if (!para.trim()) {
      y -= leading * 0.5
      continue
    }
    const words = para.split(/\s+/)
    let line = ''
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(test, fontSize) > maxWidth && line) {
        await writeLine(line)
        line = word
      } else {
        line = test
      }
    }
    if (line) await writeLine(line)
    onProgress?.(100)
  }

  return {
    files: [await pdfBlob(doc, `${o.fileName?.trim() || 'docsy-text'}.pdf`)],
    note: `${pageCount} page${pageCount === 1 ? '' : 's'} typeset locally. Standard fonts cover Latin characters only.`,
  }
}

/* ───────────────────────────── stamps & stamps ──────────────────────────── */

const WATERMARK_POS: Record<string, (w: number, h: number, tw: number, th: number) => [number, number]> = {
  center: (w, h, tw, th) => [w / 2 - tw / 2, h / 2 - th / 2],
  'top-left': (_w, h, _tw, th) => [36, h - 36 - th],
  'top-right': (w, h, tw, th) => [w - 36 - tw, h - 36 - th],
  'bottom-left': (_w, _h, _tw, th) => [36, 36 + th],
  'bottom-right': (w, _h, tw, th) => [w - 36 - tw, 36 + th],
}

export async function watermarkPdf(file: File, o: Opts, onProgress?: ProgressFn): Promise<RunResult> {
  const doc = await load(file)
  const text = String(o.text || 'CONFIDENTIAL')
  const size = clamp(Number(o.size ?? 46), 8, 200)
  const opacity = clamp(Number(o.opacity ?? 14) / 100, 0.02, 1)
  const angle = clamp(Number(o.angle ?? 35), -90, 90)
  const color = hexToRgb(o.color || '#ffffff')
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const tw = font.widthOfTextAtSize(text, size)
  const th = font.heightAtSize(size)
  const rad = (angle * Math.PI) / 180
  const pages = doc.getPages()

  pages.forEach((page, i) => {
    const { width, height } = page.getSize()
    if (o.layout === 'tile') {
      const stepX = tw + size * 2.4
      const stepY = th + size * 3.4
      let count = 0
      for (let y = -stepY; y < height + stepY; y += stepY) {
        for (let x = -stepX; x < width + stepX; x += stepX) {
          if (count++ > 90) break
          page.drawText(text, {
            x,
            y,
            size,
            font,
            color,
            opacity,
            rotate: degrees(angle),
          })
        }
      }
    } else {
      const [px, py] = (WATERMARK_POS[o.position || 'center'] || WATERMARK_POS.center)(width, height, tw, th)
      const ax = px + tw / 2
      const ay = py + th / 2
      const x = ax - (tw / 2) * Math.cos(rad) + (th / 2) * Math.sin(rad)
      const y = ay - (tw / 2) * Math.sin(rad) - (th / 2) * Math.cos(rad)
      page.drawText(text, { x, y, size, font, color, opacity, rotate: degrees(angle) })
    }
    onProgress?.(((i + 1) / pages.length) * 100)
  })

  return {
    files: [await pdfBlob(doc, `${baseName(file.name)}-watermarked.pdf`)],
    note: 'Watermark is drawn as real PDF text, not baked into a screenshot.',
  }
}

const NUMBER_POS: Record<string, [number, number, 'left' | 'center' | 'right']> = {
  'bottom-center': [0.5, 0, 'center'],
  'bottom-right': [1, 0, 'right'],
  'bottom-left': [0, 0, 'left'],
  'top-center': [0.5, 1, 'center'],
  'top-right': [1, 1, 'right'],
  'top-left': [0, 1, 'left'],
}

export async function addPageNumbers(file: File, o: Opts, onProgress?: ProgressFn): Promise<RunResult> {
  const doc = await load(file)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const size = clamp(Number(o.size ?? 10), 6, 32)
  const margin = clamp(Number(o.margin ?? 28), 8, 120)
  const start = Number(o.start ?? 1)
  const format = String(o.format || '{n} / {total}')
  const color = rgb(0.25, 0.25, 0.28)
  const pages = doc.getPages()
  const [fx, fy, align] = NUMBER_POS[o.position || 'bottom-center'] || NUMBER_POS['bottom-center']

  pages.forEach((page, i) => {
    const { width, height } = page.getSize()
    const n = start + i
    const label = format.replace(/\{n\}/g, String(n)).replace(/\{total\}/g, String(start + pages.length - 1))
    const tw = font.widthOfTextAtSize(label, size)
    let x = margin
    if (align === 'center') x = width * fx - tw / 2
    if (align === 'right') x = width - margin - tw
    const y = fy === 1 ? height - margin - size : margin
    page.drawText(label, { x, y, size, font, color })
    onProgress?.(((i + 1) / pages.length) * 100)
  })

  return {
    files: [await pdfBlob(doc, `${baseName(file.name)}-numbered.pdf`)],
    note: 'Numbers are real, searchable text at the position you chose.',
  }
}

export async function addHeaderFooter(file: File, o: Opts, onProgress?: ProgressFn): Promise<RunResult> {
  const doc = await load(file)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const size = clamp(Number(o.size ?? 9), 6, 28)
  const margin = clamp(Number(o.margin ?? 28), 8, 120)
  const color = rgb(0.32, 0.32, 0.35)
  const header = String(o.header || '')
  const footer = String(o.footer || '')
  const pages = doc.getPages()
  pages.forEach((page, i) => {
    const { width, height } = page.getSize()
    const n = i + 1
    const total = pages.length
    const apply = (tpl: string, y: number) =>
      tpl
        .replace(/\{n\}/g, String(n))
        .replace(/\{total\}/g, String(total))
        .replace(/\{title\}/g, baseName(file.name))
        .replace(/\{date\}/g, new Date().toLocaleDateString())
    if (header.trim()) {
      const t = apply(header, height - margin)
      page.drawText(t, { x: margin, y: height - margin, size, font, color })
    }
    if (footer.trim()) {
      const t = apply(footer, margin)
      page.drawText(t, { x: margin, y: margin, size, font, color })
    }
    onProgress?.(((i + 1) / pages.length) * 100)
  })
  return {
    files: [await pdfBlob(doc, `${baseName(file.name)}-header-footer.pdf`)],
    note: 'Tokens {n}, {total}, {title} and {date} are supported.',
  }
}

/* ───────────────────────────── metadata / clean ────────────────────────── */

export async function editMetadata(file: File, o: Opts): Promise<RunResult> {
  const doc = await load(file)
  doc.setTitle(String(o.title || ''))
  doc.setAuthor(String(o.author || ''))
  doc.setSubject(String(o.subject || ''))
  doc.setKeywords(
    String(o.keywords || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  )
  doc.setCreator('Docsy')
  doc.setProducer('Docsy')
  if (o.keepDates !== true) doc.setCreationDate(new Date())
  return {
    files: [await pdfBlob(doc, `${baseName(file.name)}-metadata.pdf`)],
    note: 'Metadata rewritten. The page content is untouched.',
  }
}

export async function sanitizePdf(file: File): Promise<RunResult> {
  const doc = await load(file)
  let removedAnnotations = 0
  doc.getPages().forEach((page) => {
    const annots = page.node.get(PDFName.of('Annots'))
    if (annots) removedAnnotations++
    page.node.delete(PDFName.of('Annots'))
    page.node.delete(PDFName.of('AA'))
    page.node.delete(PDFName.of('Metadata'))
  })
  const catalog = doc.catalog
  catalog.delete(PDFName.of('OpenAction'))
  catalog.delete(PDFName.of('AA'))
  catalog.delete(PDFName.of('Metadata'))
  catalog.delete(PDFName.of('Names'))
  catalog.delete(PDFName.of('AcroForm'))
  doc.setTitle('')
  doc.setAuthor('')
  doc.setSubject('')
  doc.setKeywords([])
  doc.setCreator('Docsy')
  doc.setProducer('Docsy')
  doc.setCreationDate(new Date(0))
  doc.setModificationDate(new Date(0))
  return {
    files: [await pdfBlob(doc, `${baseName(file.name)}-sanitized.pdf`)],
    note: `Stripped metadata, XMP, embedded scripts, attachments and ${
      removedAnnotations ? 'annotation objects' : 'annotation references'
    }. The pages look the same; the baggage is gone.`,
  }
}

export async function inspectPdf(file: File, onProgress?: ProgressFn): Promise<RunResult> {
  const info: PdfInfo = {
    fileName: file.name,
    fileSize: file.size,
    pages: 0,
    encrypted: false,
    hasText: false,
    scanned: false,
    title: '',
    author: '',
    creator: '',
    producer: '',
    created: '',
    sizes: [],
  }
  try {
    const doc = await openPdf(await file.arrayBuffer())
    info.pages = doc.numPages
    const meta = await doc.getMetadata()
    const raw: any = meta.info || {}
    info.title = raw.Title || ''
    info.author = raw.Author || ''
    info.creator = raw.Creator || ''
    info.producer = raw.Producer || ''
    info.created = raw.CreationDate || ''
    const seen = new Set<string>()
    for (let i = 1; i <= Math.min(doc.numPages, 6); i++) {
      const page = await doc.getPage(i)
      const vp = page.getViewport({ scale: 1 })
      const label = `${Math.round(vp.width)} × ${Math.round(vp.height)} pt`
      if (!seen.has(label)) {
        seen.add(label)
        info.sizes.push(label)
      }
    }
    let chars = 0
    for (let i = 1; i <= Math.min(doc.numPages, 3); i++) {
      const lines = await extractPageLines(doc, i)
      chars += lines.join('').replace(/\s/g, '').length
      onProgress?.((i / Math.min(doc.numPages, 3)) * 100)
    }
    info.hasText = chars > 20
    info.scanned = chars <= 20
  } catch (err) {
    if (/password/i.test(String(err))) {
      info.encrypted = true
    } else {
      throw err
    }
  }
  onProgress?.(100)
  return {
    files: [],
    info,
    note: info.encrypted
      ? 'This file is encrypted. Docsy can read its size but not its contents.'
      : info.scanned
        ? 'No meaningful text layer found. This is probably a scan — OCR is not built yet.'
        : 'This PDF has a real text layer and can be searched and extracted.',
  }
}

export async function applySignature(
  file: File,
  png: Blob,
  o: { page: number; x: number; y: number; w: number; allPages: boolean },
  onProgress?: ProgressFn
): Promise<RunResult> {
  const doc = await load(file)
  const img = await doc.embedPng(new Uint8Array(await png.arrayBuffer()))
  const pages = doc.getPages()
  const target = pages[clamp(o.page, 0, pages.length - 1)]
  const draw = (page: typeof target) => {
    const { width, height } = page.getSize()
    const w = Math.max(12, o.w * width)
    const h = (img.height / img.width) * w
    const x = clamp(o.x, 0, 1) * width
    const yTop = clamp(o.y, 0, 1) * height
    page.drawImage(img, { x, y: height - yTop - h, width: w, height: h })
  }
  if (o.allPages) pages.forEach(draw)
  else draw(target)
  onProgress?.(100)
  return {
    files: [await pdfBlob(doc, `${baseName(file.name)}-signed.pdf`)],
    note: o.allPages
      ? 'Signature placed on every page. This is a drawn signature, not a certificate-backed digital signature.'
      : 'Signature placed. This is a drawn signature, not a certificate-backed digital signature.',
  }
}

export async function pdfToZip(files: File[]): Promise<RunResult> {
  if (!files.length) throw new Error('Add at least one file.')
  const blob = await zipOutputs(files.map((f) => ({ name: f.name, blob: f })))
  return {
    files: [{ name: `docsy-${stamp()}.zip`, blob }],
    note: `${files.length} file${files.length === 1 ? '' : 's'} zipped.`,
  }
}
