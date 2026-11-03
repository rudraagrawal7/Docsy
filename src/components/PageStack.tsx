import { useRef } from 'react'

const lines = (count: number, widths = [88, 72, 94, 61, 83, 55, 90, 69]) =>
  Array.from({ length: count }, (_, i) => widths[i % widths.length])

/**
 * An abstract stack of pages, not a fake app window. It leans with the
 * pointer and breathes on its own; the content is shapes, never fake data.
 */
export function PageStack() {
  const ref = useRef<HTMLDivElement>(null)

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    el.style.setProperty('--sx', x.toFixed(3))
    el.style.setProperty('--sy', y.toFixed(3))
  }

  const reset = () => {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--sx', '0')
    el.style.setProperty('--sy', '0')
  }

  return (
    <div
      className="stack-wrap"
      ref={ref}
      onPointerMove={move}
      onPointerLeave={reset}
      aria-hidden="true"
    >
      <div className="stack-aura" />
      <div className="stack">
        <div className="sheet sheet-back">
          <div className="sheet-lines">
            {lines(5).map((w, i) => (
              <span key={i} style={{ width: `${w}%` }} />
            ))}
          </div>
          <span className="sheet-tab" />
        </div>

        <div className="sheet sheet-mid">
          <div className="sheet-lines">
            {lines(3, [70, 90, 55]).map((w, i) => (
              <span key={i} style={{ width: `${w}%` }} />
            ))}
          </div>
          <div className="sheet-block" />
          <div className="sheet-lines">
            {lines(2, [84, 62]).map((w, i) => (
              <span key={i} style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>

        <div className="sheet sheet-sign">
          <div className="sheet-lines">
            {lines(2, [76, 50]).map((w, i) => (
              <span key={i} style={{ width: `${w}%` }} />
            ))}
          </div>
          <svg className="sheet-signature" viewBox="0 0 220 60" fill="none">
            <path
              d="M6 42c18-26 28 8 44-6s18-24 33-10 8 30 27 16 18-26 39-14 15 22 35 10 20-16 30-14"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
          <span className="sheet-stamp">DOCSY</span>
        </div>

        <div className="sheet sheet-front">
          <div className="sheet-lines">
            {lines(4, [92, 78, 96, 64]).map((w, i) => (
              <span key={i} style={{ width: `${w}%` }} />
            ))}
          </div>
          <div className="sheet-block tall" />
          <div className="sheet-lines">
            {lines(3, [86, 70, 42]).map((w, i) => (
              <span key={i} style={{ width: `${w}%` }} />
            ))}
          </div>
          <span className="sheet-corner" />
        </div>
      </div>

      <span className="stack-chip stack-chip-a">merge</span>
      <span className="stack-chip stack-chip-b">sign</span>
      <span className="stack-chip stack-chip-c">convert</span>
    </div>
  )
}
