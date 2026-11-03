import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import type { Tool } from '../tools'

export function ToolCard({ tool, index = 0 }: { tool: Tool; index?: number }) {
  const Icon = tool.icon

  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    el.style.setProperty('--mx', `${e.clientX - r.left}px`)
    el.style.setProperty('--my', `${e.clientY - r.top}px`)
    el.style.setProperty('--ry', `${px * 7}deg`)
    el.style.setProperty('--rx', `${py * -7}deg`)
  }

  const onLeave = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.setProperty('--rx', '0deg')
    e.currentTarget.style.setProperty('--ry', '0deg')
  }

  const inner = (
    <>
      <div className="tool-card-top">
        <span className="tool-icon">
          <Icon size={19} strokeWidth={1.6} />
        </span>
        <span className="tool-arrow">
          <ArrowUpRight size={16} />
        </span>
      </div>
      <h3 className="tool-name">{tool.cardName || tool.name}</h3>
      <p className="tool-blurb">{tool.blurb}</p>
      <div className="tool-meta">
        {tool.popular && !!tool.ready && <span className="tag tag-accent">Popular</span>}
        {!tool.ready && <span className="tag tag-soon">In build</span>}
      </div>
      <span className="tool-glow" aria-hidden="true" />
    </>
  )

  if (!tool.ready) {
    return (
      <article
        className="tool-card is-soon"
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
        aria-disabled="true"
        title={tool.soonNote}
      >
        {inner}
      </article>
    )
  }

  return (
    <Link
      to={`/tools/${tool.id}`}
      className="tool-card"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
    >
      {inner}
    </Link>
  )
}
