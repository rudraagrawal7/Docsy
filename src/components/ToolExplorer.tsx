import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { CATEGORIES, TOOLS, type Category } from '../tools'
import { ToolCard } from './ToolCard'

type Filter = 'All' | 'Ready' | Category

export function ToolExplorer({ initial = 'All' }: { initial?: Filter }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>(initial)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return TOOLS.filter((t) => {
      if (filter === 'Ready' && !t.ready) return false
      if (filter !== 'All' && filter !== 'Ready' && t.category !== filter) return false
      if (!q) return true
      return (
        t.name.toLowerCase().includes(q) ||
        t.blurb.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        (t.id || '').includes(q)
      )
    })
  }, [query, filter])

  const groups = useMemo(() => {
    if (filter !== 'All' || query.trim()) return null
    return CATEGORIES.map((cat) => ({ cat, tools: filtered.filter((t) => t.category === cat) })).filter(
      (g) => g.tools.length
    )
  }, [filtered, filter, query])

  const filters: Filter[] = ['All', 'Ready', ...CATEGORIES]

  return (
    <div className="explorer">
      <div className="explorer-bar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a tool — merge, redact, sign…"
            aria-label="Search tools"
          />
          {query && (
            <button className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="filter-row">
          {filters.map((f) => (
            <button
              key={f}
              className={`filter-chip ${filter === f ? 'is-on' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">
          <p>No tools match “{query}”.</p>
          <button className="btn btn-ghost btn-sm" onClick={() => { setQuery(''); setFilter('All') }}>
            Reset
          </button>
        </div>
      )}

      {groups
        ? groups.map((g) => (
            <section className="tool-group" key={g.cat} aria-labelledby={`group-${g.cat}`}>
              <div className="tool-group-head">
                <h3 id={`group-${g.cat}`}>{g.cat}</h3>
                <span className="tool-group-count">{g.tools.filter((t) => t.ready).length} ready</span>
              </div>
              <div className="tool-grid">
                {g.tools.map((t, i) => (
                  <ToolCard tool={t} index={i} key={t.id} />
                ))}
              </div>
            </section>
          ))
        : (
          <div className="tool-grid tool-grid-flat">
            {filtered.map((t, i) => (
              <ToolCard tool={t} index={i} key={t.id} />
            ))}
          </div>
        )}
    </div>
  )
}
