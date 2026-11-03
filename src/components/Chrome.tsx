import { useEffect, useRef } from 'react'

/** Trailing cursor ring. Native cursor stays visible — this is decoration. */
export function Cursor() {
  const dot = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(pointer: coarse)').matches) return

    const d = dot.current
    const r = ring.current
    if (!d || !r) return

    let mx = window.innerWidth / 2
    let my = window.innerHeight / 2
    let rx = mx
    let ry = my
    let frame = 0
    let visible = false

    const show = () => {
      if (!visible) {
        visible = true
        d.classList.add('is-on')
        r.classList.add('is-on')
      }
    }

    const onMove = (e: PointerEvent) => {
      mx = e.clientX
      my = e.clientY
      show()
      d.style.transform = `translate3d(${mx}px, ${my}px, 0)`
    }

    const onOver = (e: Event) => {
      const t = e.target as Element | null
      const hot = !!t?.closest?.('a, button, [role="button"], .tool-card, .dropzone, summary, input, select, textarea')
      r.classList.toggle('is-active', hot)
    }

    const onLeave = () => {
      visible = false
      d.classList.remove('is-on')
      r.classList.remove('is-on')
    }

    const loop = () => {
      rx += (mx - rx) * 0.16
      ry += (my - ry) * 0.16
      r.style.transform = `translate3d(${rx}px, ${ry}px, 0)`
      frame = requestAnimationFrame(loop)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerover', onOver, { passive: true })
    document.addEventListener('pointerleave', onLeave)
    window.addEventListener('blur', onLeave)
    frame = requestAnimationFrame(loop)

    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerover', onOver)
      document.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('blur', onLeave)
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <>
      <div className="cursor-dot" ref={dot} aria-hidden="true" />
      <div className="cursor-ring" ref={ring} aria-hidden="true" />
    </>
  )
}

/** Thin ember line that fills as the page scrolls. */
export function ScrollProgress() {
  const bar = useRef<HTMLElement>(null)

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const max = document.documentElement.scrollHeight - window.innerHeight
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
      if (bar.current) bar.current.style.transform = `scaleX(${p})`
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div className="scroll-progress" aria-hidden="true">
      <i ref={bar} />
    </div>
  )
}
