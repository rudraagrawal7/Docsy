import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  GripVertical,
  Image as ImageIcon,
  Info,
  Loader2,
  Lock,
  Package,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  X,
  Zap,
} from 'lucide-react'
import { Dropzone } from '../components/Dropzone'
import { PreviewPanel } from '../components/Preview'
import { Reveal } from '../components/Reveal'
import { useInbox, useDocumentTitle, useToast } from '../lib/store'
import { download, dataUrlToBlob, formatBytes, readErrorMessage, stamp, zipOutputs } from '../lib/util'
import type { Opts, PdfInfo, RunResult } from '../lib/ops'
import { getTool, TOOLS, type Field, type Tool } from '../tools'

const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)
const isImage = (f: File) => /^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name)

function accepts(tool: Tool, f: File) {
  if (tool.accept === 'pdf') return isPdf(f)
  if (tool.accept === 'image') return isImage(f)
  return true
}

function defaultsFor(tool: Tool): Opts {
  const o: Opts = {}
  for (const f of tool.fields || []) o[f.key] = f.default
  return o
}

export function ToolPage() {
  const { id } = useParams()
  const tool = getTool(id)
  useDocumentTitle(tool ? `${tool.name} — Docsy` : 'Page not found — Docsy')
  if (!tool) return <NotFound />
  if (!tool.ready) return <SoonPage tool={tool} />
  if (tool.custom === 'organize') return <OrganizePage tool={tool} />
  if (tool.custom === 'sign') return <SignPage tool={tool} />
  return <GenericTool key={tool.id} tool={tool} />
}

/* ─────────────────────────────── generic ────────────────────────────────── */

function GenericTool({ tool }: { tool: Tool }) {
  const { items, addFiles: addToInbox, replaceWith } = useInbox()
  const { toast } = useToast()
  const navigate = useNavigate()
  const Icon = tool.icon

  const [files, setFiles] = useState<File[]>(() => {
    if (tool.accept === 'none') return []
    return items
      .map((i) => i.file)
      .filter((f) => accepts(tool, f))
      .slice(0, tool.multiple ? undefined : 1)
  })
  const [opts, setOpts] = useState<Opts>(() => defaultsFor(tool))
  const [running, setRunning] = useState(false)
  const [pct, setPct] = useState(0)
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<RunResult | null>(null)
  const [elapsed, setElapsed] = useState<number | null>(null)
  const [previewTab, setPreviewTab] = useState<'input' | 'output'>('input')
  const dragFrom = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  const inputSize = useMemo(() => files.reduce((s, f) => s + f.size, 0), [files])
  const outputSize = useMemo(
    () => (result?.files ? result.files.reduce((s, f) => s + f.blob.size, 0) : 0),
    [result]
  )

  const sourceItems = useMemo(() => files.map((f) => ({ name: f.name, blob: f })), [files])
  const resultItems = result?.files ?? []
  const showOutput = previewTab === 'output' && !!result?.files.length
  const liveText = tool.accept === 'none' ? String(opts.text || '') : ''
  const showPreview = showOutput
    ? resultItems.length > 0
    : sourceItems.length > 0 || !!liveText.trim()

  useEffect(() => {
    if (result?.files.length) setPreviewTab('output')
  }, [result])

  const addFiles = (incoming: File[]) => {
    const valid = incoming.filter((f) => accepts(tool, f))
    if (!valid.length) return
    addToInbox(valid)
    setResult(null)
    setError('')
    if (tool.multiple) {
      setFiles((prev) => {
        const next = [...prev]
        for (const f of valid) {
          if (!next.some((n) => n.name === f.name && n.size === f.size)) next.push(f)
        }
        return next
      })
    } else {
      setFiles(valid.slice(0, 1))
    }
  }

  const move = (from: number, to: number) => {
    setFiles((prev) => {
      if (to < 0 || to >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  const run = async () => {
    if (running || !tool.run) return
    if (tool.accept !== 'none' && files.length === 0) {
      setError(tool.accept === 'image' ? 'Add at least one image first.' : 'Add a PDF first.')
      return
    }
    if (tool.minFiles && files.length < tool.minFiles) {
      setError(`Add at least ${tool.minFiles} files for this tool.`)
      return
    }
    setRunning(true)
    setError('')
    setResult(null)
    setPct(0)
    setLabel('Starting')
    const t0 = performance.now()
    try {
      const res = await tool.run(files, opts, (p, l) => {
        setPct(Math.max(0, Math.min(100, p)))
        if (l) setLabel(l)
      })
      setResult(res)
      setElapsed((performance.now() - t0) / 1000)
      setPct(100)
    } catch (err) {
      setError(readErrorMessage(err))
    } finally {
      setRunning(false)
    }
  }

  const downloadAll = async () => {
    if (!result?.files.length) return
    if (result.files.length === 1) {
      download(result.files[0].blob, result.files[0].name)
      return
    }
    const zip = await zipOutputs(result.files)
    download(zip, `${tool.id}-${stamp()}.zip`)
  }

  const sendToTray = () => {
    if (!result?.files.length) return
    const next = result.files.map((f) => new File([f.blob], f.name, { type: f.blob.type || 'application/pdf' }))
    replaceWith(next)
    toast(`${next.length} file${next.length === 1 ? '' : 's'} moved to your tray`)
    navigate('/tools')
  }

  const acceptDrop = tool.accept === 'none' ? 'pdf' : tool.accept
  const nextTools = TOOLS.filter((t) => t.ready && t.id !== tool.id && !t.custom).slice(0, 3)

  return (
    <main className="page tool-page">
      <div className="container">
        <Link to="/tools" className="back-link">
          <ArrowLeft size={14} /> All tools
        </Link>

        <Reveal>
          <div className="tool-head">
            <div className="tool-head-main">
              <span className="tool-page-icon">
                <Icon size={24} strokeWidth={1.5} />
              </span>
              <div>
                <div className="eyebrow">{tool.category}</div>
                <h1>{tool.name}</h1>
                <p>{tool.description}</p>
              </div>
            </div>
            <div className="tool-head-badges">
              <span className="badge-local">
                <ShieldCheck size={13} /> runs locally
              </span>
              <span className="badge-soft">free · no limit</span>
            </div>
          </div>
        </Reveal>

        <div className="tool-layout">
          <div className="tool-work">
            {tool.accept !== 'none' && (
              <Dropzone
                accept={acceptDrop}
                multiple={tool.multiple}
                onFiles={addFiles}
                compact={files.length > 0}
                title={
                  files.length
                    ? tool.multiple
                      ? 'Add more files'
                      : 'Drop a replacement file'
                    : undefined
                }
                subtitle={files.length ? 'or browse to replace' : undefined}
              />
            )}

            {files.length > 0 && (
              <div className="file-list">
                <div className="file-list-head">
                  <span>
                    {files.length} file{files.length === 1 ? '' : 's'}
                    {tool.multiple && files.length > 1 ? ' · drag to reorder' : ''}
                  </span>
                  <span className="file-list-size">{formatBytes(inputSize)}</span>
                </div>
                {files.map((f, i) => (
                  <div
                    key={`${f.name}-${f.size}-${i}`}
                    className={`file-row ${dragOver === i ? 'is-over' : ''}`}
                    draggable={!!tool.multiple}
                    onDragStart={() => (dragFrom.current = i)}
                    onDragOver={(e) => {
                      if (!tool.multiple) return
                      e.preventDefault()
                      setDragOver(i)
                    }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (dragFrom.current !== null && dragFrom.current !== i) move(dragFrom.current, i)
                      dragFrom.current = null
                      setDragOver(null)
                    }}
                    onDragEnd={() => {
                      dragFrom.current = null
                      setDragOver(null)
                    }}
                  >
                    {tool.multiple && <GripVertical size={14} className="file-grip" />}
                    <span className="file-icon">
                      {tool.accept === 'image' ? <ImageIcon size={15} /> : <FileText size={15} />}
                    </span>
                    <span className="file-name" title={f.name}>
                      {f.name}
                    </span>
                    <span className="file-size">{formatBytes(f.size)}</span>
                    {tool.multiple && (
                      <span className="file-move">
                        <button onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Move up">
                          <ChevronUp size={13} />
                        </button>
                        <button
                          onClick={() => move(i, i + 1)}
                          disabled={i === files.length - 1}
                          aria-label="Move down"
                        >
                          <ChevronDown size={13} />
                        </button>
                      </span>
                    )}
                    <button
                      className="file-x"
                      onClick={() => {
                        setFiles((prev) => prev.filter((_, idx) => idx !== i))
                        setResult(null)
                      }}
                      aria-label={`Remove ${f.name}`}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!!tool.fields?.length && (
              <div className="options">
                <div className="options-head">Options</div>
                <div className="options-grid">
                  {tool.fields.map((field) => (
                    <FieldControl
                      key={field.key}
                      field={field}
                      value={opts[field.key]}
                      onChange={(v) => setOpts((o) => ({ ...o, [field.key]: v }))}
                    />
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="alert" role="alert">
                <TriangleAlert size={16} />
                <div>{error}</div>
              </div>
            )}

            <div className="run-row">
              <button
                className="btn btn-primary btn-lg run-btn"
                onClick={run}
                disabled={running || (tool.accept !== 'none' && files.length === 0)}
              >
                {running ? (
                  <>
                    <Loader2 size={17} className="spin" /> Working… {Math.round(pct)}%
                  </>
                ) : (
                  <>
                    <Zap size={16} /> {tool.id === 'merge' ? `Merge ${files.length || ''} PDFs` : tool.name}
                  </>
                )}
              </button>
              <span className="run-hint">
                <Lock size={12} /> processed in this tab
              </span>
            </div>

            {showPreview && (
              <div className="preview-block">
                {!!result?.files.length && (
                  <div className="preview-tabs" role="tablist" aria-label="Preview source">
                    <button
                      role="tab"
                      aria-selected={previewTab === 'input'}
                      className={previewTab === 'input' ? 'is-on' : ''}
                      onClick={() => setPreviewTab('input')}
                    >
                      Source
                    </button>
                    <button
                      role="tab"
                      aria-selected={previewTab === 'output'}
                      className={previewTab === 'output' ? 'is-on' : ''}
                      onClick={() => setPreviewTab('output')}
                    >
                      Result
                    </button>
                  </div>
                )}
                <PreviewPanel
                  items={showOutput ? resultItems : sourceItems}
                  text={showOutput ? undefined : liveText}
                  label={showOutput ? 'Result preview' : 'Source preview'}
                  hint={showOutput ? 'before you download' : undefined}
                />
              </div>
            )}

            {running && (
              <div className="progress-wrap">
                <div className="progress">
                  <i style={{ width: `${pct}%` }} />
                </div>
                <span className="progress-label">{label || 'Working'} — nothing is being uploaded.</span>
              </div>
            )}

            {result && (
              <div className="result">
                <div className="result-head">
                  <span className="result-check">
                    <Check size={15} strokeWidth={3} />
                  </span>
                  <div>
                    <h3>{result.info ? 'Analysis complete' : 'Done, locally'}</h3>
                    <p>
                      {elapsed !== null ? `${elapsed.toFixed(elapsed < 10 ? 1 : 0)}s` : 'Finished'} ·{' '}
                      {result.info ? formatBytes(inputSize) : `${formatBytes(inputSize)} → ${formatBytes(outputSize)}`}
                    </p>
                  </div>
                  <span className="result-local">
                    <ShieldCheck size={12} /> 0 KB uploaded
                  </span>
                </div>

                {result.info && <InfoGrid info={result.info} />}

                {result.note && <p className="result-note">{result.note}</p>}

                {result.files.length > 0 && (
                  <>
                    <div className="result-files">
                      {result.files.map((f) => (
                        <div className="result-file" key={f.name}>
                          <FileText size={15} />
                          <span className="result-file-name">{f.name}</span>
                          <span className="result-file-size">{formatBytes(f.blob.size)}</span>
                          <button className="result-dl" onClick={() => download(f.blob, f.name)}>
                            <Download size={14} /> Download
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="result-actions">
                      <button className="btn btn-primary" onClick={downloadAll}>
                        {result.files.length > 1 ? (
                          <>
                            <Package size={15} /> Download all ({result.files.length})
                          </>
                        ) : (
                          <>
                            <Download size={15} /> Download
                          </>
                        )}
                      </button>
                      <button className="btn btn-ghost" onClick={sendToTray}>
                        <ArrowRight size={15} /> Send to tray
                      </button>
                      <button
                        className="btn btn-ghost"
                        onClick={() => {
                          setResult(null)
                          setElapsed(null)
                        }}
                      >
                        <RefreshCw size={14} /> Start over
                      </button>
                    </div>
                  </>
                )}

                {result.info && (
                  <div className="result-actions">
                    <Link to="/tools/sanitize" className="btn btn-primary">
                      <ShieldCheck size={15} /> Sanitize this file
                    </Link>
                    <Link to="/tools" className="btn btn-ghost">
                      Open another tool <ArrowUpRight size={14} />
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          <aside className="tool-side">
            <div className="side-card side-privacy">
              <div className="side-card-title">
                <ShieldCheck size={15} /> Private by architecture
              </div>
              <p>
                This tool runs in your browser using the file you selected. There is no upload endpoint, no
                queue, and no copy of your document anywhere but here.
              </p>
              <div className="side-stat">
                <span>Bytes uploaded</span>
                <strong>0</strong>
              </div>
              <div className="side-stat">
                <span>Accounts required</span>
                <strong>none</strong>
              </div>
            </div>

            {tool.tip && (
              <div className="side-card side-tip">
                <div className="side-card-title">
                  <Info size={15} /> The honest bit
                </div>
                <p>{tool.tip}</p>
              </div>
            )}

            <div className="side-card">
              <div className="side-card-title">
                <Sparkles size={15} /> Keep going
              </div>
              <div className="side-links">
                {nextTools.map((t) => (
                  <Link key={t.id} to={`/tools/${t.id}`} className="side-link">
                    <t.icon size={15} />
                    {t.cardName || t.name}
                    <ArrowUpRight size={13} />
                  </Link>
                ))}
              </div>
            </div>

            <div className="side-card side-tiny">
              <Lock size={13} />
              <span>
                Tip: after a result, hit <strong>Send to tray</strong> to use it in another tool without
                re-selecting it.
              </span>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}

/* ─────────────────────────────── controls ───────────────────────────────── */

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: Field
  value: any
  onChange: (v: any) => void
}) {
  const id = `field-${field.key}`
  if (field.type === 'toggle') {
    return (
      <div className="field field-toggle">
        <label htmlFor={id}>{field.label}</label>
        <button
          id={id}
          role="switch"
          aria-checked={!!value}
          className={`switch ${value ? 'is-on' : ''}`}
          onClick={() => onChange(!value)}
          type="button"
        >
          <span />
        </button>
      </div>
    )
  }

  return (
    <div className={`field field-${field.type}`}>
      <label htmlFor={id}>{field.label}</label>
      {field.type === 'select' && (
        <div className="select-wrap">
          <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
            {field.options.map((o) => (
              <option value={o.value} key={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="select-chevron" />
        </div>
      )}
      {field.type === 'range' && (
        <div className="range-row">
          <input
            id={id}
            type="range"
            min={field.min}
            max={field.max}
            step={field.step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <span className="range-value">
            {value}
            {field.suffix}
          </span>
        </div>
      )}
      {field.type === 'textarea' && (
        <textarea
          id={id}
          rows={field.rows || 6}
          value={value || ''}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.type === 'color' && (
        <div className="color-row">
          <input
            id={id}
            type="color"
            value={value || '#999999'}
            onChange={(e) => onChange(e.target.value)}
          />
          <span className="color-hex">{value}</span>
        </div>
      )}
      {(field.type === 'text' || field.type === 'number') && (
        <input
          id={id}
          type={field.type}
          value={value ?? ''}
          min={field.min}
          max={field.max}
          step={field.step}
          placeholder={field.placeholder}
          onChange={(e) =>
            onChange(field.type === 'number' ? Number(e.target.value) : e.target.value)
          }
        />
      )}
      {field.help && <p className="field-help">{field.help}</p>}
    </div>
  )
}

function InfoGrid({ info }: { info: PdfInfo }) {
  const rows: [string, string][] = [
    ['File', info.fileName],
    ['Size', formatBytes(info.fileSize)],
    ['Pages', info.encrypted ? 'locked' : String(info.pages)],
    ['Page sizes', info.sizes.length ? info.sizes.join(', ') : '—'],
    ['Text layer', info.encrypted ? 'unknown' : info.hasText ? 'yes — searchable' : 'no — probably a scan'],
    ['Title', info.title || '—'],
    ['Author', info.author || '—'],
    ['Creator', info.creator || '—'],
    ['Producer', info.producer || '—'],
  ]
  return (
    <div className="info-grid">
      {rows.map(([k, v]) => (
        <div className="info-row" key={k}>
          <span>{k}</span>
          <strong>{v}</strong>
        </div>
      ))}
    </div>
  )
}

/* ─────────────────────────────── organize ───────────────────────────────── */

interface Thumb {
  url: string
}

function OrganizePage({ tool }: { tool: Tool }) {
  const { items, addFiles: addToInbox } = useInbox()
  const { toast } = useToast()
  const [file, setFile] = useState<File | null>(() => items.map((i) => i.file).find(isPdf) || null)
  const [thumbs, setThumbs] = useState<Thumb[]>([])
  const [pages, setPages] = useState<{ index: number; rotation: number; key: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [result, setResult] = useState<RunResult | null>(null)
  const dragFrom = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const Icon = tool.icon

  useEffect(() => {
    if (!file) return
    let cancelled = false
    setBusy(true)
    setThumbs([])
    setProgress(0)
    ;(async () => {
      try {
        const { openPdf, renderPdfPage } = await import('../lib/pdfjs')
        const doc = await openPdf(await file.arrayBuffer())
        const list: Thumb[] = []
        for (let i = 1; i <= doc.numPages; i++) {
          const { canvas } = await renderPdfPage(doc, i, 0.38)
          list.push({ url: canvas.toDataURL('image/jpeg', 0.72) })
          if (cancelled) return
          setThumbs([...list])
          setProgress((i / doc.numPages) * 100)
        }
        if (!cancelled) {
          setPages(list.map((_, i) => ({ index: i, rotation: 0, key: `p-${i}-${Math.random()}` })))
          setProgress(100)
        }
      } catch (err) {
        if (!cancelled) setError(readErrorMessage(err))
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [file])

  const move = (from: number, to: number) => {
    if (to < 0 || to >= pages.length) return
    setPages((prev) => {
      const next = [...prev]
      const [p] = next.splice(from, 1)
      next.splice(to, 0, p)
      return next
    })
  }

  const rotate = (i: number, delta: number) =>
    setPages((prev) => prev.map((p, idx) => (idx === i ? { ...p, rotation: (p.rotation + delta + 360) % 360 } : p)))

  const duplicate = (i: number) =>
    setPages((prev) => {
      const next = [...prev]
      next.splice(i + 1, 0, { ...prev[i], key: `p-${prev[i].index}-${Math.random()}` })
      return next
    })

  const remove = (i: number) => setPages((prev) => prev.filter((_, idx) => idx !== i))

  const exportIt = async () => {
    if (!file) return
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const ops = await import('../lib/ops')
      const res = await ops.exportOrganized(
        file,
        pages.map((p) => ({ index: p.index, rotation: p.rotation })),
        (p) => setProgress(p)
      )
      setResult(res)
      toast('Organized PDF is ready')
    } catch (err) {
      setError(readErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="page tool-page">
      <div className="container">
        <Link to="/tools" className="back-link">
          <ArrowLeft size={14} /> All tools
        </Link>
        <div className="tool-head">
          <div className="tool-head-main">
            <span className="tool-page-icon">
              <Icon size={24} strokeWidth={1.5} />
            </span>
            <div>
              <div className="eyebrow">{tool.category}</div>
              <h1>{tool.name}</h1>
              <p>{tool.description}</p>
            </div>
          </div>
          <div className="tool-head-badges">
            <span className="badge-local">
              <ShieldCheck size={13} /> runs locally
            </span>
          </div>
        </div>

        {!file && <Dropzone accept="pdf" onFiles={(f) => { setFile(f[0]); addToInbox([f[0]]) }} />}

        {file && (
          <>
            <div className="organize-bar">
              <div className="organize-meta">
                <FileText size={15} />
                <span className="organize-name">{file.name}</span>
                <span className="organize-count">
                  {pages.length} page{pages.length === 1 ? '' : 's'} in output
                </span>
              </div>
              <div className="organize-actions">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setFile(null)
                    setPages([])
                    setThumbs([])
                    setResult(null)
                  }}
                >
                  Choose another
                </button>
                <button className="btn btn-primary btn-sm" onClick={exportIt} disabled={busy || !pages.length}>
                  {busy ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
                  {busy ? `Working ${Math.round(progress)}%` : 'Export PDF'}
                </button>
              </div>
            </div>

            {busy && !pages.length && (
              <div className="progress-wrap">
                <div className="progress">
                  <i style={{ width: `${progress}%` }} />
                </div>
                <span className="progress-label">Rendering thumbnails locally…</span>
              </div>
            )}

            {error && (
              <div className="alert">
                <TriangleAlert size={16} /> {error}
              </div>
            )}

            <div className="page-grid">
              {pages.map((p, i) => (
                <div
                  key={p.key}
                  className={`page-card ${dragOver === i ? 'is-over' : ''}`}
                  draggable
                  onDragStart={() => (dragFrom.current = i)}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(i)
                  }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (dragFrom.current !== null) move(dragFrom.current, i)
                    dragFrom.current = null
                    setDragOver(null)
                  }}
                  onDragEnd={() => {
                    dragFrom.current = null
                    setDragOver(null)
                  }}
                >
                  <div className="page-thumb">
                    <img src={thumbs[p.index]?.url} alt={`Page ${p.index + 1}`} style={{ transform: `rotate(${p.rotation}deg)` }} />
                    <span className="page-no">{i + 1}</span>
                    <span className="page-drag">
                      <GripVertical size={12} />
                    </span>
                  </div>
                  <div className="page-actions">
                    <button onClick={() => rotate(i, -90)} title="Rotate left" aria-label="Rotate left">
                      <RefreshCw size={13} style={{ transform: 'scaleX(-1)' }} />
                    </button>
                    <button onClick={() => rotate(i, 90)} title="Rotate right" aria-label="Rotate right">
                      <RefreshCw size={13} />
                    </button>
                    <button onClick={() => duplicate(i)} title="Duplicate" aria-label="Duplicate page">
                      <Package size={13} />
                    </button>
                    <button onClick={() => remove(i)} title="Delete" aria-label="Delete page" className="danger">
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}
              {pages.length === 0 && !busy && (
                <div className="empty-state">
                  <p>All pages removed. Keep at least one to export.</p>
                </div>
              )}
            </div>

            {result && (
              <div className="result">
                <div className="result-head">
                  <span className="result-check">
                    <Check size={15} strokeWidth={3} />
                  </span>
                  <div>
                    <h3>Organized PDF is ready</h3>
                    <p>{result.note}</p>
                  </div>
                </div>
                <div className="result-files">
                  {result.files.map((f) => (
                    <div className="result-file" key={f.name}>
                      <FileText size={15} />
                      <span className="result-file-name">{f.name}</span>
                      <span className="result-file-size">{formatBytes(f.blob.size)}</span>
                      <button className="result-dl" onClick={() => download(f.blob, f.name)}>
                        <Download size={14} /> Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="organize-hint">
              <ShieldCheck size={13} /> Drag pages to reorder. Rotate, duplicate or delete. Exporting builds a new
              file; your original is untouched.
            </p>
          </>
        )}
      </div>
    </main>
  )
}

/* ─────────────────────────────── sign ───────────────────────────────────── */

function SignPage({ tool }: { tool: Tool }) {
  const { items, addFiles: addToInbox } = useInbox()
  const { toast } = useToast()
  const [file, setFile] = useState<File | null>(() => items.map((i) => i.file).find(isPdf) || null)
  const [pageCount, setPageCount] = useState(0)
  const [page, setPage] = useState(0)
  const [preview, setPreview] = useState<string>('')
  const [pagePt, setPagePt] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  const [loading, setLoading] = useState(false)
  const [sig, setSig] = useState<{ url: string; ratio: number } | null>(null)
  const [pos, setPos] = useState({ x: 0.62, y: 0.78 })
  const [width, setWidth] = useState(28)
  const [allPages, setAllPages] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<RunResult | null>(null)
  const padRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const Icon = tool.icon

  useEffect(() => {
    if (!file) return
    let cancelled = false
    setLoading(true)
    setPreview('')
    setSig(null)
    setResult(null)
    setError('')
    ;(async () => {
      try {
        const { openPdf, renderPdfPage } = await import('../lib/pdfjs')
        const doc = await openPdf(await file.arrayBuffer())
        if (cancelled) return
        setPageCount(doc.numPages)
        const target = Math.min(page + 1, doc.numPages)
        const { canvas } = await renderPdfPage(doc, target, 1.6)
        if (cancelled) return
        setPreview(canvas.toDataURL('image/jpeg', 0.88))
        const pg = await doc.getPage(target)
        const vp = pg.getViewport({ scale: 1 })
        setPagePt({ w: vp.width, h: vp.height })
      } catch (err) {
        if (!cancelled) setError(readErrorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, page])

  // signature pad sizing
  useEffect(() => {
    const c = padRef.current
    if (!c) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    c.width = Math.round(c.clientWidth * dpr)
    c.height = Math.round(c.clientHeight * dpr)
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.lineWidth = 2.6 * dpr
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#111318'
  }, [file])

  useEffect(() => {
    const c = padRef.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const down = (e: PointerEvent) => {
      const r = c.getBoundingClientRect()
      const dpr = c.width / r.width
      drawing.current = true
      last.current = { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr }
      c.setPointerCapture(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      if (!drawing.current || !last.current) return
      const r = c.getBoundingClientRect()
      const dpr = c.width / r.width
      const p = { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr }
      const scale = dpr
      ctx.lineWidth = 2.6 * scale
      ctx.beginPath()
      ctx.moveTo(last.current.x, last.current.y)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
      last.current = p
    }
    const up = () => {
      drawing.current = false
      last.current = null
    }
    c.addEventListener('pointerdown', down)
    c.addEventListener('pointermove', move)
    c.addEventListener('pointerup', up)
    c.addEventListener('pointercancel', up)
    return () => {
      c.removeEventListener('pointerdown', down)
      c.removeEventListener('pointermove', move)
      c.removeEventListener('pointerup', up)
      c.removeEventListener('pointercancel', up)
    }
  }, [file])

  const clearPad = () => {
    const c = padRef.current
    if (!c) return
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
  }

  const useSignature = () => {
    const c = padRef.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const { width: w, height: h } = c
    const data = ctx.getImageData(0, 0, w, h).data
    let minX = w,
      minY = h,
      maxX = 0,
      maxY = 0,
      found = false
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 8) {
          found = true
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    if (!found) {
      setError('Draw a signature first — or at least an initial.')
      return
    }
    const pad = 6
    const cw = maxX - minX + pad * 2
    const ch = maxY - minY + pad * 2
    const out = document.createElement('canvas')
    out.width = cw
    out.height = ch
    const octx = out.getContext('2d')!
    octx.drawImage(c, minX - pad, minY - pad, cw, ch, 0, 0, cw, ch)
    setSig({ url: out.toDataURL('image/png'), ratio: ch / cw })
    setError('')
    toast('Signature applied to the preview')
  }

  const place = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!sig) return
    if ((e.target as HTMLElement).classList.contains('sign-stamp')) return
    const r = e.currentTarget.getBoundingClientRect()
    setPos({
      x: Math.min(0.98, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(0.98, Math.max(0, (e.clientY - r.top) / r.height)),
    })
  }

  const startDrag = (e: React.PointerEvent) => {
    e.stopPropagation()
    dragging.current = true
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onDrag = (e: React.PointerEvent) => {
    if (!dragging.current || !previewRef.current) return
    const r = previewRef.current.getBoundingClientRect()
    setPos({
      x: Math.min(0.98, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(0.98, Math.max(0, (e.clientY - r.top) / r.height)),
    })
  }

  const apply = async () => {
    if (!file || !sig) {
      setError('Signature is missing. Draw one first.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const ops = await import('../lib/ops')
      const blob = dataUrlToBlob(sig.url)
      const res = await ops.applySignature(file, blob, {
        page,
        x: pos.x,
        y: pos.y,
        w: width / 100,
        allPages,
      })
      setResult(res)
      toast('Signed PDF is ready')
    } catch (err) {
      setError(readErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="page tool-page">
      <div className="container">
        <Link to="/tools" className="back-link">
          <ArrowLeft size={14} /> All tools
        </Link>
        <div className="tool-head">
          <div className="tool-head-main">
            <span className="tool-page-icon">
              <Icon size={24} strokeWidth={1.5} />
            </span>
            <div>
              <div className="eyebrow">{tool.category}</div>
              <h1>{tool.name}</h1>
              <p>{tool.description}</p>
            </div>
          </div>
          <div className="tool-head-badges">
            <span className="badge-local">
              <ShieldCheck size={13} /> runs locally
            </span>
          </div>
        </div>

        {!file && <Dropzone accept="pdf" onFiles={(f) => { setFile(f[0]); setPage(0); addToInbox([f[0]]) }} />}

        {file && (
          <div className="sign-layout">
            <div className="sign-main">
              <div className="sign-toolbar">
                <div className="sign-file">
                  <FileText size={14} />
                  <span>{file.name}</span>
                </div>
                <div className="sign-pager">
                  <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                    <ChevronUp size={14} style={{ transform: 'rotate(-90deg)' }} />
                  </button>
                  <span>
                    Page {page + 1} / {pageCount || '…'}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    disabled={page >= pageCount - 1}
                  >
                    <ChevronDown size={14} style={{ transform: 'rotate(-90deg)' }} />
                  </button>
                </div>
                <button className="btn btn-ghost btn-xs" onClick={() => { setFile(null); setResult(null) }}>
                  Change file
                </button>
              </div>

              <div className={`sign-preview ${sig ? 'has-sig' : ''}`}>
                {loading && (
                  <div className="sign-loading">
                    <Loader2 className="spin" size={18} /> Rendering page locally…
                  </div>
                )}
                <div
                  className="sign-canvas"
                  ref={previewRef}
                  onClick={place}
                  onPointerMove={onDrag}
                  onPointerUp={() => (dragging.current = false)}
                >
                  {preview && <img src={preview} alt={`Page ${page + 1}`} draggable={false} />}
                  {sig && (
                    <img
                      className="sign-stamp"
                      src={sig.url}
                      alt="Placed signature"
                      style={{
                        left: `${pos.x * 100}%`,
                        top: `${pos.y * 100}%`,
                        width: `${width}%`,
                      }}
                      onPointerDown={startDrag}
                      draggable={false}
                    />
                  )}
                  {sig && !loading && (
                    <span className="sign-place-hint">Click to move · drag to fine-tune</span>
                  )}
                </div>
              </div>

              {error && (
                <div className="alert">
                  <TriangleAlert size={16} /> {error}
                </div>
              )}

              <div className="sign-foot">
                <div className="sign-settings">
                  <label>
                    Signature size
                    <input
                      type="range"
                      min={8}
                      max={70}
                      value={width}
                      onChange={(e) => setWidth(Number(e.target.value))}
                    />
                    <span>{width}%</span>
                  </label>
                  <label className="sign-check">
                    <input type="checkbox" checked={allPages} onChange={(e) => setAllPages(e.target.checked)} />
                    Place on every page
                  </label>
                </div>
                <button className="btn btn-primary" onClick={apply} disabled={busy || !sig}>
                  {busy ? <Loader2 size={15} className="spin" /> : <Download size={15} />}
                  {busy ? 'Signing…' : 'Apply signature'}
                </button>
              </div>

              {result && (
                <div className="result">
                  <div className="result-head">
                    <span className="result-check">
                      <Check size={15} strokeWidth={3} />
                    </span>
                    <div>
                      <h3>Signed PDF is ready</h3>
                      <p>{result.note}</p>
                    </div>
                  </div>
                  <div className="result-files">
                    {result.files.map((f) => (
                      <div className="result-file" key={f.name}>
                        <FileText size={15} />
                        <span className="result-file-name">{f.name}</span>
                        <span className="result-file-size">{formatBytes(f.blob.size)}</span>
                        <button className="result-dl" onClick={() => download(f.blob, f.name)}>
                          <Download size={14} /> Download
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <aside className="sign-side">
              <div className="side-card">
                <div className="side-card-title">
                  <PenIcon /> Draw your signature
                </div>
                <div className="sig-pad-wrap">
                  <canvas ref={padRef} className="sig-pad" />
                </div>
                <div className="sig-buttons">
                  <button className="btn btn-ghost btn-sm" onClick={clearPad}>
                    Clear
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={useSignature}>
                    Use signature
                  </button>
                </div>
                <p className="sig-hint">
                  Draw with a mouse, trackpad or finger. The background is stripped out automatically.
                </p>
              </div>

              <div className="side-card side-tip">
                <div className="side-card-title">
                  <Info size={15} /> What this is — and isn’t
                </div>
                <p>
                  This is a drawn signature image. It is not a certificate-backed digital signature, and Docsy
                  keeps no audit trail. For contracts that need cryptographic proof, use a dedicated signing
                  service.
                </p>
              </div>

              <div className="side-card side-tiny">
                <Lock size={13} /> Your signature never leaves this tab either. It is not stored between
                sessions.
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  )
}

function PenIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M12 19l7-7 3 3-7 7-3-3z" />
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
      <path d="M2 2l7.586 7.586" />
      <circle cx="11" cy="11" r="2" />
    </svg>
  )
}

/* ─────────────────────────────── fallbacks ──────────────────────────────── */

function SoonPage({ tool }: { tool: Tool }) {
  const Icon = tool.icon
  return (
    <main className="page">
      <div className="container narrow">
        <Link to="/tools" className="back-link">
          <ArrowLeft size={14} /> All tools
        </Link>
        <div className="soon-panel">
          <span className="tool-page-icon">
            <Icon size={26} strokeWidth={1.5} />
          </span>
          <div className="tag tag-soon">In build — not shipped</div>
          <h1>{tool.name}</h1>
          <p className="soon-blurb">{tool.description}</p>
          <div className="soon-note">
            <TriangleAlert size={16} />
            <p>{tool.soonNote || 'This tool is not ready yet. We would rather be honest than ship a fake.'}</p>
          </div>
          <div className="soon-actions">
            <Link to="/tools" className="btn btn-primary">
              Browse ready tools <ArrowRight size={15} />
            </Link>
            <Link to="/#privacy" className="btn btn-ghost">
              Why we ship slowly
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}

export function NotFound() {
  return (
    <main className="page">
      <div className="container narrow">
        <div className="soon-panel">
          <div className="tag tag-soon">404</div>
          <h1>That page slipped out of the tray.</h1>
          <p className="soon-blurb">The link is broken or the tool does not exist yet.</p>
          <Link to="/tools" className="btn btn-primary">
            Back to the toolkit <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </main>
  )
}
