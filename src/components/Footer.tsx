import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Instagram, ShieldCheck } from 'lucide-react'
import { LogoMark } from './Logo'
import { getBlockedCount, subscribeBlocked } from '../lib/guard'

export function Footer() {
  const [blocked, setBlocked] = useState(getBlockedCount())
  useEffect(() => {
    const unsubscribe = subscribeBlocked(setBlocked)
    return () => {
      unsubscribe()
    }
  }, [])

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="footer-logo">
              <LogoMark size={30} />
              <span>docsy</span>
            </div>
            <p className="footer-tag">Your PDFs. Your device. Your privacy.</p>
            <div className="privacy-pill">
              <ShieldCheck size={14} />
              {blocked === 0 ? '0 external requests this session' : `${blocked} external request${blocked === 1 ? '' : 's'} blocked`}
            </div>
          </div>

          <div className="footer-col">
            <h4>Toolkit</h4>
            <Link to="/tools/merge">Merge</Link>
            <Link to="/tools/split">Split</Link>
            <Link to="/tools/compress">Compress</Link>
            <Link to="/tools/sign">Sign</Link>
            <Link to="/tools/pdf-to-images">PDF to images</Link>
          </div>
          <div className="footer-col">
            <h4>More</h4>
            <Link to="/tools/organize">Organize</Link>
            <Link to="/tools/watermark">Watermark</Link>
            <Link to="/tools/page-numbers">Page numbers</Link>
            <Link to="/tools/sanitize">Sanitize</Link>
            <Link to="/tools/inspect">Inspect</Link>
          </div>
          <div className="footer-col">
            <h4>Docsy</h4>
            <Link to="/#privacy">Privacy</Link>
            <Link to="/#how">How it works</Link>
            <Link to="/#faq">FAQ</Link>
            <Link to="/tools">All tools</Link>
          </div>
        </div>

        <div className="footer-base">
          <p>
            Designed &amp; coded by{' '}
            <a href="https://instagram.com/rudraagrawal.exe/" target="_blank" rel="noreferrer noopener">
              Rudra Agrawal <ArrowUpRight size={12} />
            </a>
          </p>
          <div className="footer-social">
            <a
              href="https://instagram.com/rudraagrawal.exe/"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Instagram"
            >
              <Instagram size={16} />
            </a>
            <span className="footer-dot" />
            <span>© {new Date().getFullYear()} Docsy</span>
          </div>
        </div>
        <p className="footer-fine">
          No cookies. No trackers. No servers touching your documents. This site is free because it costs almost
          nothing to run — not because your files are the product.
        </p>
      </div>
    </footer>
  )
}
