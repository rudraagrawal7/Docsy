import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ArrowUpRight, Menu, ShieldCheck, X } from 'lucide-react'
import { Logo } from './Logo'
import { useInbox, useScrolled } from '../lib/store'
import { formatBytes } from '../lib/util'

const links = [
  { to: '/tools', label: 'Tools' },
  { to: '/#privacy', label: 'Privacy' },
  { to: '/#how', label: 'How it works' },
]

export function Nav() {
  const scrolled = useScrolled(16)
  const [open, setOpen] = useState(false)
  const { items, totalSize } = useInbox()
  const location = useLocation()

  useEffect(() => {
    setOpen(false)
  }, [location.pathname, location.hash])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      <header className={`nav ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="nav-inner">
          <Logo />
          <nav className="nav-links" aria-label="Main">
            {links.map((l) => (
              <Link key={l.to} to={l.to} className="nav-link">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="nav-right">
            {items.length > 0 && (
              <Link to="/tools" className="tray-chip" title="Files in your local tray">
                <span className="tray-dot" />
                {items.length} file{items.length === 1 ? '' : 's'}
                <span className="tray-size">{formatBytes(totalSize)}</span>
              </Link>
            )}
            <Link to="/tools" className="btn btn-primary btn-sm nav-cta">
              Open toolkit
              <ArrowUpRight size={15} strokeWidth={2} />
            </Link>
            <button className="nav-burger" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className={`mobile-menu ${open ? 'is-open' : ''}`}>
        <div className="mobile-menu-head">
          <Logo />
          <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close menu">
            <X size={22} />
          </button>
        </div>
        <div className="mobile-menu-links">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className="mobile-link">
              {l.label}
              <ArrowUpRight size={18} />
            </Link>
          ))}
        </div>
        <div className="mobile-menu-foot">
          <div className="privacy-pill">
            <ShieldCheck size={14} /> 0 bytes uploaded · ever
          </div>
          <p className="muted small">Your files never leave this browser.</p>
        </div>
      </div>
    </>
  )
}
