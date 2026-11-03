import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUpRight, UploadCloud } from 'lucide-react'

export function Dropzone({
  accept,
  multiple = false,
  onFiles,
  compact = false,
  title,
  subtitle,
  disabled = false,
}: {
  accept: 'pdf' | 'image' | 'any' | 'none'
  multiple?: boolean
  onFiles: (files: File[]) => void
  compact?: boolean
  title?: string
  subtitle?: string
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [rejected, setRejected] = useState('')
  const depth = useRef(0)

  const pick = useCallback(
    (list: FileList | File[] | null) => {
      if (!list) return
      const files = Array.from(list)
      const ok = files.filter((f) => {
        if (accept === 'pdf') return /\.pdf$/i.test(f.name) || f.type === 'application/pdf'
        if (accept === 'image') return /^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name)
        return true
      })
      if (!ok.length) {
        setRejected(accept === 'pdf' ? 'That is not a PDF. Docsy will not guess.' : 'That file is not an image.')
        setTimeout(() => setRejected(''), 3200)
        return
      }
      onFiles(multiple ? ok : ok.slice(0, 1))
    },
    [accept, multiple, onFiles]
  )

  useEffect(() => {
    if (disabled) return
    const onPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return
      const files = Array.from(e.clipboardData.files)
      if (files.length) pick(files)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [pick, disabled])

  const acceptAttr = accept === 'pdf' ? 'application/pdf,.pdf' : accept === 'image' ? 'image/*' : undefined
  const isWrong = (e: React.DragEvent) => {
    if (accept === 'none' || accept === 'any') return false
    const items = Array.from(e.dataTransfer.items || [])
    if (!items.length) return false
    return !items.some((i) =>
      accept === 'pdf' ? i.type === 'application/pdf' : i.type.startsWith('image/')
    )
  }

  return (
    <div
      className={`dropzone ${compact ? 'is-compact' : ''} ${dragging ? 'is-dragging' : ''} ${
        disabled ? 'is-disabled' : ''
      }`}
      role="button"
      tabIndex={0}
      aria-label="Drop files or browse"
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          inputRef.current?.click()
        }
      }}
      onDragEnter={(e) => {
        e.preventDefault()
        if (disabled) return
        depth.current++
        setDragging(true)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        if (isWrong(e)) e.dataTransfer.dropEffect = 'none'
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        depth.current = Math.max(0, depth.current - 1)
        if (depth.current === 0) setDragging(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        depth.current = 0
        setDragging(false)
        if (!disabled) pick(e.dataTransfer.files)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr}
        multiple={multiple}
        hidden
        onChange={(e) => {
          pick(e.target.files)
          e.currentTarget.value = ''
        }}
      />
      <div className="dropzone-icon">
        <UploadCloud size={compact ? 17 : 22} strokeWidth={1.6} />
      </div>
      <div className="dropzone-copy">
        <div className="dropzone-title">
          {rejected || title || (accept === 'image' ? 'Drop images here' : accept === 'any' ? 'Drop a PDF or image here' : 'Drop your PDF here')}
        </div>
        <div className="dropzone-sub">
          {rejected ? (
            'Try a different file.'
          ) : (
            subtitle || (
              <>
                or <span className="linklike">browse files</span>
              </>
            )
          )}
        </div>
      </div>
      {!compact && (
        <div className="dropzone-action">
          Browse <ArrowUpRight size={15} />
        </div>
      )}
    </div>
  )
}
