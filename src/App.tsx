import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Cursor, ScrollProgress } from './components/Chrome'
import { Nav } from './components/Nav'
import { Footer } from './components/Footer'
import { Home } from './pages/Home'
import { ToolsIndex } from './pages/ToolsIndex'
import { NotFound, ToolPage } from './pages/ToolPage'
import { InboxProvider, ToastProvider } from './lib/store'

function ScrollManager() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      const el = document.querySelector(hash)
      if (el) {
        const t = window.setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40)
        return () => window.clearTimeout(t)
      }
    }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname, hash])
  return null
}

function Shell() {
  const { pathname } = useLocation()

  return (
    <>
      <Cursor />
      <ScrollProgress />
      <Nav />
      <div className="route-frame" key={pathname}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tools" element={<ToolsIndex />} />
          <Route path="/tools/:id" element={<ToolPage />} />
          <Route path="/privacy" element={<Navigate to="/#privacy" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
      <Footer />
    </>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
      <ToastProvider>
        <InboxProvider>
          <Shell />
        </InboxProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
