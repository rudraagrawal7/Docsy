import { Link } from 'react-router-dom'

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" className="logo-mark">
      <rect width="512" height="512" rx="128" fill="currentColor" className="logo-tile" />
      <path
        d="M168 112h116l76 76v216a24 24 0 0 1-24 24H168a24 24 0 0 1-24-24V136a24 24 0 0 1 24-24z"
        fill="var(--bg)"
      />
      <path d="M284 112l76 76h-52a24 24 0 0 1-24-24z" fill="var(--muted-2)" />
      <rect x="196" y="252" width="120" height="15" rx="7.5" fill="var(--fg)" opacity=".9" />
      <rect x="196" y="292" width="86" height="15" rx="7.5" fill="var(--fg)" opacity=".5" />
      <circle cx="352" cy="362" r="46" fill="var(--accent)" />
      <path
        d="M331 362l14 14 27-29"
        fill="none"
        stroke="var(--bg)"
        strokeWidth="13"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="logo" aria-label="Docsy home">
      <LogoMark size={27} />
      <span className="logo-word">docsy</span>
    </Link>
  )
}
