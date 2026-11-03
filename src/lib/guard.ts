let blocked = 0
const listeners = new Set<(n: number) => void>()
let installed = false

function emit() {
  listeners.forEach((fn) => fn(blocked))
}

export function installNetworkGuard() {
  if (installed || typeof window === 'undefined') return
  installed = true
  const origin = window.location.origin

  const isExternal = (url: string) => {
    if (/^(data|blob|file):/i.test(url)) return false
    try {
      return new URL(url, origin).origin !== origin
    } catch {
      return false
    }
  }

  if (window.fetch) {
    const original = window.fetch.bind(window)
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url
      if (isExternal(url)) {
        blocked++
        emit()
        return Promise.reject(new Error('Docsy blocked an external request. Documents never leave this tab.'))
      }
      return original(input, init)
    }) as typeof fetch
  }

  const xhrOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    ...rest: any[]
  ) {
    if (isExternal(String(url))) {
      blocked++
      emit()
      throw new Error('Docsy blocked an external request.')
    }
    return (xhrOpen as any).call(this, method, url, ...rest)
  } as typeof XMLHttpRequest.prototype.open

  if (navigator.sendBeacon) {
    const beacon = navigator.sendBeacon.bind(navigator)
    navigator.sendBeacon = ((url: string | URL, data?: BodyInit | null) => {
      if (isExternal(String(url))) {
        blocked++
        emit()
        return false
      }
      return beacon(url, data)
    }) as typeof navigator.sendBeacon
  }
}

export function getBlockedCount() {
  return blocked
}

export function subscribeBlocked(fn: (n: number) => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
