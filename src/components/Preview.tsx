import { useEffect, useMemo, useState } from 'react'
import { FileText, Loader2, Package } from 'lucide-react'

export interface PreviewItem {
  name: string
  blob: Blob
}

interface Shot {
  key: string
  name: string
  label: string
  url?: string
  text?: string
  kind: 'page' | 'image' | 'text' | 'file'
}

const isPdf = (item: PreviewItem) =>
  item.blob.type === 'application/pdf' || /\.pdf$/i.test(item.name)
const isImage = (item: PreviewItem) => /^image\//.test(item.blob.type)
const isText = (item: PreviewItem) =>
  /^text\//.test(item.blob.type) || /\.(txt|md|csv)$/i.test(item.name)

/**
 * Live document preview. Inputs and outputs both go through here: PDFs are
 * rendered by pdf.js, images are shown directly, text is typeset on paper.
 * The engine import is dynamic, so the marketing page never pays for it.
 */
export function PreviewPanel({
  items,
  text,
  label = 'Preview',
  hint,
  dense = false,
}: {
  items: PreviewItem[]
  text?: string
  label?: string
  hint?: string
  dense?: boolean
}) {
  const [shots, setShots] = useState<Shot[]>([])
  const [loading, setLoading] = useState(false)

  const signature = useMemo(
    () => items.map((i) => `${i.name}:${i.blob.size}:${i.blob.type}`).join('|') + `#${(text || '').length}`,
    [items, text]
  )

  useEffect(() => {
    let cancelled = false
    const urls: string[] = []
    setShots([])

    if (!items.length) {
      setLoading(false)
      return
    }

    setLoading(true)
    ;(async () => {
      const out: Shot[] = []
      const push = (shot: Shot) => {
        if (cancelled) return
        out.push(shot)
        setShots([...out])
      }
      let total = 0
      const MAX = 6

      for (const item of items) {
        if (total >= MAX) break

        if (isPdf(item)) {
          try {
            const { openPdf, renderPdfPage } = await import('../lib/pdfjs')
            const doc = await openPdf(await item.blob.arrayBuffer())
            const perFile = items.length === 1 ? 3 : 1
            const count = Math.max(1, Math.min(doc.numPages, perFile, MAX - total))
            for (let p = 1; p <= count; p++) {
              const { canvas } = await renderPdfPage(doc, p, 0.55)
              if (cancelled) return
              push({
                key: `${item.name}-p${p}`,
                name: item.name,
                label: doc.numPages > 1 ? `Page ${p} / ${doc.numPages}` : 'Page 1',
                url: canvas.toDataURL('image/jpeg', 0.74),
                kind: 'page',
              })
              total++
            }
          } catch {
            push({ key: item.name, name: item.name, label: 'PDF', kind: 'file' })
            total++
          }
          continue
        }

        if (isImage(item)) {
          const url = URL.createObjectURL(item.blob)
          urls.push(url)
          push({ key: `${item.name}-img`, name: item.name, label: 'Image', url, kind: 'image' })
          total++
          continue
        }

        if (isText(item)) {
          const body = await item.blob.text().catch(() => '')
          push({
            key: `${item.name}-txt`,
            name: item.name,
            label: 'Text',
            kind: 'text',
            text: body.slice(0, 2600),
          })
          total++
          continue
        }

        const ext = item.name.split('.').pop()?.toUpperCase() || 'FILE'
        push({ key: item.name, name: item.name, label: ext, kind: 'file' })
        total++
      }
      if (!cancelled) setLoading(false)
    })()

    return () => {
      cancelled = true
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  if (!items.length && !text?.trim()) return null

  return (
    <section className={`preview-panel ${dense ? 'is-dense' : ''}`} aria-label={label}>
      <div className="preview-head">
        <span className="preview-title">
          <span className="preview-dot" />
          {label}
        </span>
        <span className="preview-hint">
          {loading ? (
            <>
              <Loader2 size={11} className="spin" /> rendering locally…
            </>
          ) : (
            hint || (items.length > 1 ? `${items.length} files` : 'on this device')
          )}
        </span>
      </div>

      <div className="preview-strip">
        {text?.trim() && (
          <div className="preview-card is-paper">
            <div className="preview-paper">
              <span className="preview-paper-title">Page 1</span>
              <p>{text.slice(0, 1400)}</p>
            </div>
            <div className="preview-meta">
              <span>Live text</span>
              <em>{text.trim().split(/\s+/).length} words</em>
            </div>
          </div>
        )}

        {shots.map((shot) => (
          <figure className={`preview-card ${shot.kind === 'page' ? 'is-page' : ''}`} key={shot.key}>
            {shot.kind === 'page' && shot.url && <img src={shot.url} alt={`${shot.name} — ${shot.label}`} />}
            {shot.kind === 'image' && shot.url && <img src={shot.url} alt={shot.name} className="is-photo" />}
            {shot.kind === 'text' && (
              <div className="preview-text">
                <FileText size={15} />
                <p>{shot.text}</p>
              </div>
            )}
            {shot.kind === 'file' && (
              <div className="preview-file">
                <Package size={22} strokeWidth={1.4} />
                <span>{shot.label}</span>
              </div>
            )}
            <figcaption className="preview-meta">
              <span title={shot.name}>{shot.name}</span>
              <em>{shot.label}</em>
            </figcaption>
          </figure>
        ))}

        {loading && shots.length === 0 && (
          <div className="preview-skeleton" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        )}
      </div>
    </section>
  )
}
