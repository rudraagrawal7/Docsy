import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export interface InboxItem {
  id: string
  file: File
}

interface InboxValue {
  items: InboxItem[]
  addFiles: (files: File[]) => InboxItem[]
  remove: (id: string) => void
  clear: () => void
  replaceWith: (files: File[]) => void
  totalSize: number
}

const InboxContext = createContext<InboxValue | null>(null)

let counter = 0
const makeItem = (file: File): InboxItem => ({ id: `f${++counter}`, file })

export function InboxProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<InboxItem[]>([])

  const addFiles = useCallback((files: File[]) => {
    const added: InboxItem[] = []
    setItems((prev) => {
      const next = [...prev]
      for (const file of files) {
        const exists = next.some(
          (i) => i.file.name === file.name && i.file.size === file.size && i.file.lastModified === file.lastModified
        )
        if (exists) continue
        const item = makeItem(file)
        next.push(item)
        added.push(item)
      }
      return next
    })
    return added
  }, [])

  const remove = useCallback((id: string) => setItems((prev) => prev.filter((i) => i.id !== id)), [])
  const clear = useCallback(() => setItems([]), [])
  const replaceWith = useCallback((files: File[]) => setItems(files.map(makeItem)), [])

  const totalSize = useMemo(() => items.reduce((sum, i) => sum + i.file.size, 0), [items])

  const value = useMemo(
    () => ({ items, addFiles, remove, clear, replaceWith, totalSize }),
    [items, addFiles, remove, clear, replaceWith, totalSize]
  )

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>
}

export function useInbox() {
  const ctx = useContext(InboxContext)
  if (!ctx) throw new Error('useInbox must be used inside InboxProvider')
  return ctx
}

/* ── toasts ───────────────────────────────────────────────────────────────── */

interface Toast {
  id: number
  text: string
}
const ToastContext = createContext<{ toast: (text: string) => void } | null>(null)
let toastId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const toast = useCallback((text: string) => {
    const id = ++toastId
    setToasts((t) => [...t, { id, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])
  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

/* ── small hooks ──────────────────────────────────────────────────────────── */

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title
  }, [title])
}

export function useScrolled(threshold = 12) {  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])
  return scrolled
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  )
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}
