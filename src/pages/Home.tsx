import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  FileText,
  Gauge,
  Layers,
  Lock,
  ShieldCheck,
  Sparkles,
  WifiOff,
  Zap,
} from 'lucide-react'
import { Dropzone } from '../components/Dropzone'
import { PageStack } from '../components/PageStack'
import { Reveal } from '../components/Reveal'
import { ToolExplorer } from '../components/ToolExplorer'
import { useInbox, useDocumentTitle, useToast } from '../lib/store'
import { formatBytes } from '../lib/util'
import { READY_TOOLS } from '../tools'

const isImage = (f: File) => /^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name)

export function Home() {
  const navigate = useNavigate()
  const { addFiles, items, totalSize } = useInbox()
  const { toast } = useToast()
  useDocumentTitle('Docsy — Your PDFs. Your device. Your privacy.')

  const handleFiles = (files: File[]) => {
    if (!files.length) return
    addFiles(files)
    const images = files.every(isImage)
    toast(
      images
        ? `${files.length} image${files.length === 1 ? '' : 's'} added to your tray`
        : `${files.length} file${files.length === 1 ? '' : 's'} added to your tray`
    )
    if (images) navigate('/tools/images-to-pdf')
    else if (files.length > 1) navigate('/tools/merge')
    else navigate('/tools/organize')
  }

  const faqs = [
    {
      q: 'Is this actually free?',
      a: 'Yes. No page limits, no watermarks on your output, no “sign up to download”. Docsy has no backend, so it costs almost nothing to run — that is the whole trick.',
    },
    {
      q: 'Where do my files go?',
      a: 'Nowhere. They are opened with the browser’s own file API and processed in memory. There is no upload endpoint because there is no server-side code. You can open DevTools → Network and watch it stay quiet.',
    },
    {
      q: 'Does it work offline?',
      a: 'Yes, after the first visit. Docsy registers a service worker and installs as an app, so the toolkit keeps working with the network switched off. No fonts, analytics or scripts are pulled from third parties.',
    },
    {
      q: 'Why are some tools marked “In build”?',
      a: 'Because a half-working Protect or OCR would be worse than an honest wait. Password encryption, OCR, redaction and comparison are queued. They will be labelled when they need anything from the network.',
    },
    {
      q: 'Can it handle a huge PDF?',
      a: 'Small and medium documents are easy. Very large files are limited by your device’s memory, not by an artificial upload cap. There is no server to bail us out, so we will tell you when a file is too heavy for the tab.',
    },
    {
      q: 'Is a drawn signature legally binding?',
      a: 'In many places, an electronic signature can be valid if both sides intend it to be. But Docsy’s signature is a drawn image, not a certificate-backed digital signature, and there is no audit trail. For contracts that need proof, ask the recipient what they accept.',
    },
    {
      q: 'Do you track anything?',
      a: 'No analytics, no cookies, no crash reporting, no third-party fonts. Docsy also installs a small runtime guard that blocks external network requests and reports how many it stopped. If something ever needs the network, it will be labelled before you use it.',
    },
  ]

  return (
    <main>
      {/* ── hero ─────────────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-bg" aria-hidden="true">
          <div className="hero-orb" />
          <div className="hero-orb hero-orb-b" />
          <div className="hero-grid" />
        </div>

        <div className="container hero-inner">
          <div className="hero-copy">
            <h1 className="hero-title">
              <span className="hero-line">
                <span>Your PDFs.</span>
              </span>
              <span className="hero-line hero-line-dim">
                <span>Your device.</span>
              </span>
            </h1>

            <p className="hero-sub">
              Merge, split, compress, sign and convert — without accounts, queues or watermarks.
            </p>

            <div className="hero-drop">
              <Dropzone accept="any" multiple onFiles={handleFiles} />
              <div className="hero-trust">
                <span><WifiOff size={14} /> works offline</span>
                <span><Gauge size={14} /> {READY_TOOLS.length} tools</span>
                <span><Lock size={14} /> no account</span>
                <span><ShieldCheck size={14} /> no watermark</span>
              </div>
              {items.length > 0 && (
                <Link to="/tools" className="tray-resume">
                  <span className="tray-dot" />
                  Continue with {items.length} file{items.length === 1 ? '' : 's'} · {formatBytes(totalSize)}
                  <ArrowRight size={14} />
                </Link>
              )}
            </div>
          </div>

          <div className="hero-visual">
            <PageStack />
          </div>
        </div>

        <div className="hero-marquee" aria-hidden="true">
          <div className="marquee-track">
            {[0, 1].map((copy) => (
              <div className="marquee-group" key={copy}>
                {READY_TOOLS.map((t) => (
                  <span className="marquee-item" key={`${copy}-${t.id}`}>
                    {t.cardName || t.name}
                    <i>·</i>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── tools ────────────────────────────────────────────────────────── */}
      <section className="section tools-section" id="tools">
        <div className="container">
          <Reveal>
            <div className="section-head">
              <div className="eyebrow">The toolkit</div>
              <h2 className="section-title">
                Everything PDF.
                <br />
                <span className="dim">Nothing uploaded.</span>
              </h2>
              <p className="section-sub">
                Free tools that run entirely in your browser. Pick one, or drop a file above and start from
                there.
              </p>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <ToolExplorer />
          </Reveal>
          <Reveal>
            <div className="section-cta">
              <Link to="/tools" className="btn btn-ghost">
                Browse the full toolkit <ArrowUpRight size={15} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── tray ─────────────────────────────────────────────────────────── */}
      <section className="section tray-section">
        <div className="container tray-grid">
          <Reveal className="tray-copy">
            <div className="eyebrow">One workspace</div>
            <h2 className="section-title">
              Drop once.
              <br />
              <span className="dim">Do everything.</span>
            </h2>
            <p className="section-sub">
              Most PDF sites make you upload the same file again for every tool. Docsy keeps your files in a
              local tray, so you can merge, then compress, then sign — without a single round trip.
            </p>
            <ul className="check-list">
              <li><Check size={15} /> Files persist across tools while the tab is open</li>
              <li><Check size={15} /> Outputs can go straight back into the tray</li>
              <li><Check size={15} /> Nothing is written to a server, ever</li>
              <li><Check size={15} /> Close the tab and it is gone — by design</li>
            </ul>
            <Link to="/tools" className="btn btn-primary">
              Open the workspace <ArrowRight size={16} />
            </Link>
          </Reveal>

          <Reveal delay={100} className="tray-visual">
            <div className="tray-demo">
              <div className="tray-demo-head">
                <span className="tray-demo-title">Your tray</span>
                <span className="tray-demo-count">3 files · 4.8 MB</span>
              </div>
              {[
                ['Q3-invoices.pdf', '1.9 MB', '12 pages'],
                ['scan-0042.pdf', '2.4 MB', '6 pages'],
                ['signature.png', '0.5 MB', 'image'],
              ].map(([name, size, meta], i) => (
                <div className="tray-demo-row" key={name} style={{ animationDelay: `${i * 120}ms` }}>
                  <span className="tray-demo-icon">
                    <FileText size={15} />
                  </span>
                  <span className="tray-demo-name">{name}</span>
                  <span className="tray-demo-meta">{meta}</span>
                  <span className="tray-demo-size">{size}</span>
                </div>
              ))}
              <div className="tray-demo-rule" />
              <div className="tray-demo-next">
                <span>Continue with</span>
                <div className="tray-demo-actions">
                  {['Merge', 'Compress', 'Sign', 'Sanitize'].map((t) => (
                    <span className="tray-demo-chip" key={t}>{t}</span>
                  ))}
                </div>
              </div>
              <div className="tray-demo-live">
                <span className="dot" /> processed in this tab · 0 KB uploaded
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── privacy ──────────────────────────────────────────────────────── */}
      <section className="section privacy-section" id="privacy">
        <div className="container">
          <Reveal>
            <div className="privacy-panel">
              <div className="privacy-main">
                <div className="eyebrow">
                  <ShieldCheck size={14} /> Privacy by architecture
                </div>
                <h2 className="section-title">
                  The file never
                  <br />
                  leaves your device.
                </h2>
                <p className="section-sub">
                  This is not a policy promise. It is how the software is built. There is no upload endpoint to
                  call, no bucket to leak and no account to breach — because there is no account.
                </p>
                <div className="privacy-points">
                  <div><Zap size={16} /><strong>No waiting room</strong><span>No queue, no “preparing your file”, no server round trip.</span></div>
                  <div><WifiOff size={16} /><strong>Offline capable</strong><span>Install it, switch off the network, keep working.</span></div>
                  <div><Lock size={16} /><strong>No account</strong><span>No email, no login, no upload history.</span></div>
                  <div><Sparkles size={16} /><strong>No watermark</strong><span>Your output is your output. We do not brand it.</span></div>
                </div>
              </div>

              <div className="privacy-side">
                <div className="disclosure">
                  <div className="disclosure-head">
                    <span className="dot" />
                    What leaves your device
                  </div>
                  <div className="disclosure-big">Nothing.</div>
                  <ul className="disclosure-list">
                    <li><Check size={13} /> No analytics or tracking pixels</li>
                    <li><Check size={13} /> No third-party fonts or CDNs</li>
                    <li><Check size={13} /> No crash reporting</li>
                    <li><Check size={13} /> No cookies, no fingerprinting</li>
                    <li><Check size={13} /> No document processing on a server</li>
                  </ul>
                  <div className="disclosure-foot">
                    <ShieldCheck size={13} />
                    Runtime guard active — external requests are blocked and counted.
                  </div>
                </div>
                <div className="honesty">
                  <div className="honesty-title">The honest part</div>
                  <p>
                    Some tools genuinely need network access or heavier libraries. When we add one — OCR language
                    data, for example — it will be labelled <em>before</em> you use it, never quietly fetched in
                    the background.
                  </p>
                  <p>
                    We also will not call a re-rendered PDF “lossless”, a drawn signature “certified”, or a
                    password prompt “encryption” until it actually is.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── how it works ─────────────────────────────────────────────────── */}
      <section className="section how-section" id="how">
        <div className="container">
          <Reveal>
            <div className="section-head center">
              <div className="eyebrow">How it works</div>
              <h2 className="section-title">Three steps. No round trip.</h2>
            </div>
          </Reveal>
          <div className="steps">
            {[
              {
                n: '01',
                t: 'Drop it in',
                d: 'Choose a file or drag it onto the page. Docsy reads it straight from disk into this tab.',
                icon: FileText,
              },
              {
                n: '02',
                t: 'Pick a tool',
                d: 'Merge, split, compress, sign, convert, sanitize. Switch tools without re-uploading.',
                icon: Layers,
              },
              {
                n: '03',
                t: 'Take it back',
                d: 'Download the result. It is created in memory and never passes through a server.',
                icon: ArrowUpRight,
              },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 80}>
                <div className="step">
                  <div className="step-top">
                    <span className="step-n">{s.n}</span>
                    <s.icon size={18} strokeWidth={1.5} />
                  </div>
                  <h3>{s.t}</h3>
                  <p>{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={240}>
            <div className="no-list">
              {['No upload', 'No sign-up', 'No watermark', 'No daily limit', 'No “premium” tease', 'No server queue'].map(
                (t) => (
                  <span key={t} className="no-item">
                    <span className="no-x">×</span> {t}
                  </span>
                )
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── faq ──────────────────────────────────────────────────────────── */}
      <section className="section faq-section" id="faq">
        <div className="container faq-grid">
          <Reveal className="faq-head">
            <div className="eyebrow">Questions</div>
            <h2 className="section-title">
              Ask the
              <br />
              <span className="dim">uncomfortable ones.</span>
            </h2>
            <p className="section-sub">
              The PDF industry is full of dark patterns. Here is where Docsy stands.
            </p>
          </Reveal>
          <Reveal delay={80} className="faq-list">
            {faqs.map((f) => (
              <details className="faq" key={f.q}>
                <summary>
                  {f.q}
                  <ChevronDown size={16} className="faq-chevron" />
                </summary>
                <div className="faq-body">{f.a}</div>
              </details>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── cta ──────────────────────────────────────────────────────────── */}
      <section className="section cta-section">
        <div className="container">
          <Reveal>
            <div className="cta-panel">
              <div className="cta-orb" aria-hidden="true" />
              <h2>
                Drop a PDF.
                <br />
                <span className="dim">See for yourself.</span>
              </h2>
              <p>No account wall. No upload bar. Just the file, the browser, and you.</p>
              <Dropzone accept="pdf" multiple onFiles={handleFiles} compact />
              <Link to="/tools" className="cta-link">
                Or open the full toolkit <ArrowUpRight size={15} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  )
}
