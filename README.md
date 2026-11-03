# Docsy

**Your PDFs. Your device. Your privacy.**

A client-side PDF toolkit. Every tool runs inside the browser tab — there is no backend, no upload endpoint, no account, and no document ever leaves the device.

Designed (Developer's own AI) and coded by [Rudra Agrawal](https://instagram.com/rudraagrawal.exe/).

---

## What is built

26 working tools, grouped into four sections:

**Essentials**
- Merge PDF (drag to reorder)
- Split PDF (extract, ranges, one-per-page)
- Compress PDF (target quality/resolution, before/after comparison)
- Organize PDF (visual reorder, rotate, duplicate, delete)
- Rotate, Remove Pages, Extract Pages, Add Blank Pages, Duplicate Pages

**Edit & sign**
- Sign PDF (draw, place, apply)
- Watermark (text, opacity, angle, tiled or single)
- Page Numbers, Header & Footer
- Crop (non-destructive crop box, stated honestly)
- Resize (A4 / A3 / A5 / Letter / Legal / Tabloid)

**Convert**
- PDF to Images (PNG / JPG / WebP at 72–400 DPI)
- Images to PDF (JPG / PNG / WebP, A4 / Letter / A3 / native)
- PDF to Text, Text to PDF
- Contact Sheet, PDF to ZIP

**Clean & inspect**
- Sanitize (strip metadata, XMP, scripts, attachments, annotation refs)
- Metadata Editor, Inspect PDF
- Flatten (rasterised, stated honestly)
- Invert / Grayscale

Tools marked **In build** are deliberately not clickable. OCR, redaction, encryption, unlock, compare, forms and image extraction are queued. They ship when they can be honest, not before.

## Preview and motion

Every tool page previews the file that came in and the file that comes out. PDFs are rendered by pdf.js (loaded lazily on first preview), images are shown directly, and text is typeset on paper. After a run, the preview switches from **Source** to **Result** automatically.

The interface is warm near-black with a single ember accent, an abstract page-stack hero, a pointer-trailing ring, scroll progress, route transitions, and subtle pointer tilt on tool cards. Cursor decoration is disabled on touch devices, and all motion respects `prefers-reduced-motion`.

## Stack

- React 18 + TypeScript + Vite
- [`pdf-lib`](https://pdf-lib.js.org/) — assembling, copying, rotating and writing PDFs
- [`pdf.js`](https://mozilla.github.io/pdf.js/) — rendering pages and extracting text
- Canvas API — rasterising, compression, signatures, recolouring
- JSZip — multi-file downloads
- Hand-written service worker — offline support (production only)

No UI framework, no external fonts, no analytics, no CDN, no cookies.

### Performance

The PDF engine is **lazy-loaded**. Landing on `/` or `/tools` ships only the UI
(~115 KB gzipped) — no `pdf-lib`, no `pdf.js`, no PDF worker. The engine
(~185 KB gzipped) is fetched the first time a tool actually runs. See
`src/tools.ts` (`loadOps`) and `vite.config.ts`.

## Privacy by architecture

- All file reads use the browser’s `File` API; processing happens in memory.
- The app contains **no upload code** and no server-side endpoints.
- `src/lib/guard.ts` patches `fetch`, `XMLHttpRequest` and `sendBeacon` at startup. External requests are blocked and counted. The footer shows the live count.
- The service worker only handles same-origin requests, and uses network-first for navigations so deploys are picked up immediately.
- The repository is private; if it is ever opened up, the source itself is the privacy proof.

**Honest limits:** `pdf-lib` cannot encrypt or decrypt PDFs, so Protect/Unlock are not faked. “Compress” re-renders pages as images, which loses the text layer — the UI says so. “Flatten” and “Resize” are rasterising operations. A drawn signature is not a certificate-backed digital signature. OCR will need self-hosted language data before it ships.

## License

Private work. All rights reserved.
