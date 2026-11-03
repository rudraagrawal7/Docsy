import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, FileText, Image as ImageIcon, ShieldCheck, X } from 'lucide-react'
import { Reveal } from '../components/Reveal'
import { ToolExplorer } from '../components/ToolExplorer'
import { Dropzone } from '../components/Dropzone'
import { useInbox, useDocumentTitle, useToast } from '../lib/store'
import { formatBytes } from '../lib/util'
import { READY_TOOLS } from '../tools'

export function ToolsIndex() {
  const { items, addFiles, remove, clear, totalSize } = useInbox()
  const { toast } = useToast()
  useDocumentTitle('All tools — Docsy')

  const handleFiles = (files: File[]) => {
    addFiles(files)
    toast(`${files.length} file${files.length === 1 ? '' : 's'} added to the tray`)
  }

  const hasPdf = items.some((i) => i.file.type === 'application/pdf' || /\.pdf$/i.test(i.file.name))
  const hasImage = items.some((i) => /^image\//.test(i.file.type))

  const suggestions = READY_TOOLS.filter((t) => {
    if (t.accept === 'none') return false
    if (t.accept === 'image') return hasImage && !hasPdf
    return hasPdf
  }).slice(0, 8)

  return (
    <main className="page">
      <section className="page-head">
        <div className="container">
          <Reveal>
            <div className="eyebrow">
              <ShieldCheck size={13} /> The full toolkit
            </div>
            <h1 className="page-title">
              Everything PDF.
              <br />
              <span className="dim">Nothing uploaded.</span>
            </h1>
            <p className="page-sub">
              {READY_TOOLS.length} tools that actually work, running in this tab. Free, unlimited, no account.
              Drop a file and move between tools without ever re-uploading.
            </p>
          </Reveal>

          <Reveal delay={70}>
            <div className="index-drop">
              <Dropzone accept="any" multiple onFiles={handleFiles} compact />
              <span className="index-drop-note">PDFs, or images for JPG → PDF</span>
            </div>
          </Reveal>

          {items.length > 0 && (
            <Reveal delay={40}>
              <div className="tray-panel">
                <div className="tray-panel-head">
                  <div>
                    <span className="tray-panel-title">Local tray</span>
                    <span className="tray-panel-count">
                      {items.length} file{items.length === 1 ? '' : 's'} · {formatBytes(totalSize)}
                    </span>
                  </div>
                  <button className="btn btn-ghost btn-xs" onClick={clear}>
                    Clear all
                  </button>
                </div>
                <div className="tray-panel-files">
                  {items.map((it) => (
                    <div className="tray-file" key={it.id}>
                      <span className="tray-file-icon">
                        {/^image\//.test(it.file.type) ? <ImageIcon size={14} /> : <FileText size={14} />}
                      </span>
                      <span className="tray-file-name">{it.file.name}</span>
                      <span className="tray-file-size">{formatBytes(it.file.size)}</span>
                      <button className="tray-file-x" onClick={() => remove(it.id)} aria-label={`Remove ${it.file.name}`}>
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
                {suggestions.length > 0 && (
                  <div className="tray-panel-next">
                    <span>Continue with</span>
                    <div className="tray-next-links">
                      {suggestions.map((t) => (
                        <Link to={`/tools/${t.id}`} key={t.id} className="tray-next">
                          {t.cardName || t.name}
                          <ArrowUpRight size={12} />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                <div className="tray-panel-foot">
                  <span className="dot" /> These files exist only in this tab’s memory.
                </div>
              </div>
            </Reveal>
          )}
        </div>
      </section>

      <section className="section section-tight">
        <div className="container">
          <ToolExplorer />
          <div className="index-footnote">
            <ShieldCheck size={14} />
            Every ready tool above runs 100% locally. “In build” tools are labelled honestly and are not clickable.
            <Link to="/#privacy">
              Why? <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
