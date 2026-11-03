import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

/** Open a PDF from bytes. Each call gets its own copy so pdf.js can't detach our buffer. */
export async function openPdf(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  const copy = new Uint8Array(data.slice(0))
  return pdfjs.getDocument({ data: copy, isEvalSupported: false }).promise
}

export interface RenderedPage {
  canvas: HTMLCanvasElement
  width: number
  height: number
  scale: number
}

export async function renderPdfPage(
  doc: PDFDocumentProxy,
  pageNumber: number,
  scale: number,
  maxPixels = 18_000_000
): Promise<RenderedPage> {
  const page = await doc.getPage(pageNumber)
  const base = page.getViewport({ scale: 1 })
  let s = scale
  const px = base.width * s * base.height * s
  if (px > maxPixels) s = Math.sqrt(maxPixels / (base.width * base.height))
  const viewport = page.getViewport({ scale: s })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(viewport.width))
  canvas.height = Math.max(1, Math.floor(viewport.height))
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('Your browser could not create a canvas.')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport }).promise
  return { canvas, width: canvas.width, height: canvas.height, scale: s }
}

export interface TextLine {
  text: string
  y: number
  x: number
}

export async function extractPageLines(doc: PDFDocumentProxy, pageNumber: number): Promise<TextLine[]> {
  const page = await doc.getPage(pageNumber)
  const content = await page.getTextContent()
  const lines: TextLine[] = []
  let current: { y: number; x: number; parts: string[] } | null = null
  for (const item of content.items as any[]) {
    if (!('str' in item)) continue
    const str: string = item.str
    if (!str) continue
    const x = item.transform?.[4] ?? 0
    const y = item.transform?.[5] ?? 0
    if (!current || Math.abs(current.y - y) > 2.2) {
      if (current) lines.push({ text: current.parts.join(' '), x: current.x, y: current.y })
      current = { y, x, parts: [str] }
    } else {
      current.parts.push(str)
    }
  }
  if (current) lines.push({ text: current.parts.join(' '), x: current.x, y: current.y })
  lines.sort((a, b) => b.y - a.y || a.x - b.x)
  return lines
}

export async function extractText(
  file: File,
  onProgress?: (pct: number) => void
): Promise<{ text: string; pages: number }> {
  const doc = await openPdf(await file.arrayBuffer())
  const chunks: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const lines = await extractPageLines(doc, i)
    chunks.push(lines.map((l) => l.text).join('\n'))
    onProgress?.((i / doc.numPages) * 100)
  }
  return { text: chunks.join('\n\n--- page break ---\n\n'), pages: doc.numPages }
}

export { pdfjs }
export type { PDFDocumentProxy }
