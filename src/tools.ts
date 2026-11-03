import type { LucideIcon } from 'lucide-react'
import {
  Archive,
  Combine,
  Copy,
  Crop,
  Droplets,
  Eraser,
  Files,
  FilePlus2,
  FileSearch,
  FileText,
  GitCompare,
  Hash,
  ImagePlus,
  Images,
  LayoutGrid,
  Layers,
  Lock,
  Minimize2,
  Palette,
  PenTool,
  QrCode,
  RotateCw,
  ScanLine,
  Scissors,
  ShieldCheck,
  Scaling,
  Tags,
  Trash2,
  Type,
  Unlock,
  Wrench,
  FileOutput,
  ListChecks,
  Sparkles,
} from 'lucide-react'
import type { Opts, ProgressFn, RunResult } from './lib/ops'

type OpsModule = typeof import('./lib/ops')
type RunFn = (files: File[], opts: Opts, progress: ProgressFn) => Promise<RunResult>

/* The PDF engine (pdf-lib + pdf.js) is ~800 KB. It is loaded the first time a
   tool actually runs, so the marketing site and the tool index stay light. */
let engine: Promise<OpsModule> | null = null
const loadOps = () => {
  if (!engine) {
    engine = import('./lib/ops')
    // Let a failed load (e.g. first visit while offline) be retried.
    engine.catch(() => {
      engine = null
    })
  }
  return engine
}

const lazy = (build: (ops: OpsModule) => RunFn): RunFn => {
  return async (files, opts, progress) => {
    const ops = await loadOps()
    return build(ops)(files, opts, progress)
  }
}

const one =
  (fn: (file: File, o: Opts, p?: ProgressFn) => Promise<RunResult>): RunFn =>
  (files, o, p) =>
    fn(files[0], o, p)

export type Category = 'Essentials' | 'Edit & sign' | 'Convert' | 'Clean & inspect'

export type Field =
  | {
      key: string
      label: string
      type: 'text' | 'number' | 'color' | 'textarea'
      default: string | number
      placeholder?: string
      help?: string
      min?: number
      max?: number
      step?: number
      rows?: number
    }
  | { key: string; label: string; type: 'select'; default: string; options: { value: string; label: string }[]; help?: string }
  | { key: string; label: string; type: 'range'; default: number; min: number; max: number; step: number; suffix?: string; help?: string }
  | { key: string; label: string; type: 'toggle'; default: boolean; help?: string }

export interface Tool {
  id: string
  name: string
  cardName?: string
  blurb: string
  description: string
  category: Category
  icon: LucideIcon
  accept: 'pdf' | 'image' | 'none'
  multiple?: boolean
  minFiles?: number
  ready: boolean
  popular?: boolean
  fields?: Field[]
  run?: (files: File[], opts: Opts, progress: ProgressFn) => Promise<RunResult>
  custom?: 'organize' | 'sign'
  tip?: string
  soonNote?: string
}

const range = (min: number, max: number) => String(min) + '-' + String(max)

export const TOOLS: Tool[] = [
  /* ── Essentials ─────────────────────────────────────────────────────────── */
  {
    id: 'merge',
    name: 'Merge PDF',
    cardName: 'Merge',
    blurb: 'Combine files, reorder them, download one PDF.',
    description:
      'Drop several PDFs, drag them into the order you want, and get one clean document. Bookmarks and links are preserved where the source allows it.',
    category: 'Essentials',
    icon: Combine,
    accept: 'pdf',
    multiple: true,
    minFiles: 2,
    ready: true,
    popular: true,
    run: lazy((m) => m.mergePdfs),
    tip: 'Order matters. Use the arrows on each file card to move it up or down.',
  },
  {
    id: 'split',
    name: 'Split PDF',
    cardName: 'Split',
    blurb: 'Extract pages or split into ranges and single pages.',
    description:
      'Pull out exactly the pages you need, split a document into ranges, or break every page into its own PDF. All local, all instant.',
    category: 'Essentials',
    icon: Scissors,
    accept: 'pdf',
    ready: true,
    popular: true,
    fields: [
      {
        key: 'mode',
        label: 'Mode',
        type: 'select',
        default: 'extract',
        options: [
          { value: 'extract', label: 'Extract pages into one PDF' },
          { value: 'ranges', label: 'Split ranges into separate PDFs' },
          { value: 'each', label: 'Every page as its own PDF' },
        ],
      },
      {
        key: 'ranges',
        label: 'Pages',
        type: 'text',
        default: '1-3, 5',
        placeholder: '1-3, 5, 8-',
        help: 'Comma-separated. A trailing dash means "to the end".',
      },
    ],
    run: lazy((m) => one(m.splitPdf)),
  },
  {
    id: 'compress',
    name: 'Compress PDF',
    cardName: 'Compress',
    blurb: 'Hit a size target. See exactly what it saved.',
    description:
      'Docsy re-renders your pages at the quality you choose and shows the before/after size. If compression would make the file bigger, it says so and leaves it alone.',
    category: 'Essentials',
    icon: Minimize2,
    accept: 'pdf',
    ready: true,
    popular: true,
    fields: [
      { key: 'quality', label: 'Image quality', type: 'range', default: 72, min: 30, max: 95, step: 1, suffix: '%' },
      {
        key: 'scale',
        label: 'Render resolution',
        type: 'select',
        default: '1.5',
        options: [
          { value: '1', label: '1× — smallest file' },
          { value: '1.5', label: '1.5× — balanced' },
          { value: '2', label: '2× — sharper' },
          { value: '2.5', label: '2.5× — print-ish' },
        ],
        help: 'Higher resolution looks better and compresses less.',
      },
    ],
    tip: 'Real compression means re-encoding page images. Text becomes non-selectable — we will not hide that trade-off.',
    run: lazy((m) => one(m.compressPdf)),
  },
  {
    id: 'organize',
    name: 'Organize PDF',
    cardName: 'Organize',
    blurb: 'Reorder, rotate, duplicate and delete visually.',
    description:
      'A filmstrip of every page. Drag to reorder, rotate or delete anything, then export. Your original file is never modified.',
    category: 'Essentials',
    icon: LayoutGrid,
    accept: 'pdf',
    ready: true,
    custom: 'organize',
  },
  {
    id: 'rotate',
    name: 'Rotate PDF',
    cardName: 'Rotate',
    blurb: 'Turn every page, or only the sideways ones.',
    description: 'Fix a landscape scan without touching the rest of the document.',
    category: 'Essentials',
    icon: RotateCw,
    accept: 'pdf',
    ready: true,
    fields: [
      {
        key: 'angle',
        label: 'Rotation',
        type: 'select',
        default: '90',
        options: [
          { value: '90', label: '90° clockwise' },
          { value: '180', label: '180°' },
          { value: '270', label: '90° counter-clockwise' },
        ],
      },
      { key: 'pages', label: 'Pages (blank = all)', type: 'text', default: '', placeholder: 'e.g. 2, 4-6' },
    ],
    run: lazy((m) => one(m.rotatePdf)),
  },
  {
    id: 'remove-pages',
    name: 'Remove Pages',
    cardName: 'Remove pages',
    blurb: 'Delete pages without leaving a trace.',
    description: 'Drop the pages you do not want. The exported file simply does not contain them.',
    category: 'Essentials',
    icon: Trash2,
    accept: 'pdf',
    ready: true,
    fields: [
      { key: 'pages', label: 'Pages to remove', type: 'text', default: '2', placeholder: 'e.g. 2, 5-7', help: 'Comma-separated ranges.' },
    ],
    run: lazy((m) => one(m.removePages)),
  },
  {
    id: 'extract-pages',
    name: 'Extract Pages',
    cardName: 'Extract pages',
    blurb: 'Keep only the pages you choose.',
    description: 'The inverse of removing pages. Produce a slimmed document with exactly your selection.',
    category: 'Essentials',
    icon: FileOutput,
    accept: 'pdf',
    ready: true,
    fields: [{ key: 'pages', label: 'Pages to keep', type: 'text', default: '1', placeholder: 'e.g. 1-3, 8' }],
    run: lazy((m) => one(m.extractPages)),
  },
  {
    id: 'add-blank',
    name: 'Add Blank Pages',
    cardName: 'Add blank pages',
    blurb: 'Make room for notes, at the start, end or middle.',
    description: 'Insert clean pages that match your document’s dimensions, or pick a standard size.',
    category: 'Essentials',
    icon: FilePlus2,
    accept: 'pdf',
    ready: true,
    fields: [
      { key: 'count', label: 'How many', type: 'number', default: 1, min: 1, max: 50 },
      {
        key: 'position',
        label: 'Where',
        type: 'select',
        default: 'end',
        options: [
          { value: 'end', label: 'At the end' },
          { value: 'start', label: 'At the beginning' },
          { value: 'after', label: 'After a specific page' },
        ],
      },
      { key: 'afterPage', label: 'After page', type: 'number', default: 1, min: 1 },
      {
        key: 'size',
        label: 'Page size',
        type: 'select',
        default: 'match',
        options: [
          { value: 'match', label: 'Match the document' },
          { value: 'A4', label: 'A4' },
          { value: 'Letter', label: 'US Letter' },
        ],
      },
    ],
    run: lazy((m) => one(m.addBlankPages)),
  },
  {
    id: 'duplicate-pages',
    name: 'Duplicate Pages',
    cardName: 'Duplicate pages',
    blurb: 'Repeat a page for print runs or templates.',
    description: 'Copy selected pages in place, as many times as you need.',
    category: 'Essentials',
    icon: Copy,
    accept: 'pdf',
    ready: true,
    fields: [
      { key: 'pages', label: 'Pages to duplicate', type: 'text', default: '1', placeholder: 'e.g. 1-2' },
      { key: 'times', label: 'Extra copies', type: 'number', default: 1, min: 1, max: 10 },
    ],
    run: lazy((m) => one(m.duplicatePages)),
  },

  /* ── Edit & sign ────────────────────────────────────────────────────────── */
  {
    id: 'sign',
    name: 'Sign PDF',
    cardName: 'Sign',
    blurb: 'Draw a signature, place it, download.',
    description:
      'Draw with a mouse, trackpad or finger. Place the mark anywhere on any page. It is a drawn signature — not a certificate-backed digital signature, and we will never pretend otherwise.',
    category: 'Edit & sign',
    icon: PenTool,
    accept: 'pdf',
    ready: true,
    popular: true,
    custom: 'sign',
  },
  {
    id: 'watermark',
    name: 'Watermark PDF',
    cardName: 'Watermark',
    blurb: 'Text watermarks with real opacity and angle.',
    description: 'Stamp “CONFIDENTIAL”, a name, or a draft label across one page or all of them. Tiled or single.',
    category: 'Edit & sign',
    icon: Droplets,
    accept: 'pdf',
    ready: true,
    fields: [
      { key: 'text', label: 'Watermark text', type: 'text', default: 'CONFIDENTIAL' },
      { key: 'size', label: 'Size', type: 'range', default: 46, min: 10, max: 140, step: 1, suffix: 'pt' },
      { key: 'opacity', label: 'Opacity', type: 'range', default: 14, min: 2, max: 100, step: 1, suffix: '%' },
      { key: 'angle', label: 'Angle', type: 'range', default: 35, min: -90, max: 90, step: 1, suffix: '°' },
      { key: 'layout', label: 'Layout', type: 'select', default: 'single', options: [{ value: 'single', label: 'One mark' }, { value: 'tile', label: 'Tiled across the page' }] },
      {
        key: 'position',
        label: 'Position',
        type: 'select',
        default: 'center',
        options: [
          { value: 'center', label: 'Center' },
          { value: 'top-left', label: 'Top left' },
          { value: 'top-right', label: 'Top right' },
          { value: 'bottom-left', label: 'Bottom left' },
          { value: 'bottom-right', label: 'Bottom right' },
        ],
      },
      { key: 'color', label: 'Color', type: 'color', default: '#9aa0aa' },
    ],
    run: lazy((m) => one(m.watermarkPdf)),
  },
  {
    id: 'page-numbers',
    name: 'Add Page Numbers',
    cardName: 'Page numbers',
    blurb: 'Numbers that look like they were always there.',
    description: 'Choose the position, format, starting number and size. Real PDF text, not a sticker.',
    category: 'Edit & sign',
    icon: Hash,
    accept: 'pdf',
    ready: true,
    popular: true,
    fields: [
      { key: 'format', label: 'Format', type: 'text', default: '{n} / {total}', help: 'Use {n} for the page and {total} for the last page.' },
      {
        key: 'position',
        label: 'Position',
        type: 'select',
        default: 'bottom-center',
        options: [
          { value: 'bottom-center', label: 'Bottom center' },
          { value: 'bottom-right', label: 'Bottom right' },
          { value: 'bottom-left', label: 'Bottom left' },
          { value: 'top-center', label: 'Top center' },
          { value: 'top-right', label: 'Top right' },
          { value: 'top-left', label: 'Top left' },
        ],
      },
      { key: 'start', label: 'Start at', type: 'number', default: 1, min: 1 },
      { key: 'size', label: 'Font size', type: 'number', default: 10, min: 6, max: 32 },
      { key: 'margin', label: 'Margin', type: 'number', default: 28, min: 8, max: 120 },
    ],
    run: lazy((m) => one(m.addPageNumbers)),
  },
  {
    id: 'header-footer',
    name: 'Header & Footer',
    cardName: 'Header / footer',
    blurb: 'Titles, dates and page counts on every page.',
    description: 'Add a running header or footer with tokens for page number, total pages, filename and date.',
    category: 'Edit & sign',
    icon: ListChecks,
    accept: 'pdf',
    ready: true,
    fields: [
      { key: 'header', label: 'Header text', type: 'text', default: '', placeholder: '{title}' },
      { key: 'footer', label: 'Footer text', type: 'text', default: 'Page {n} of {total}', placeholder: 'Page {n} of {total}' },
      { key: 'size', label: 'Font size', type: 'number', default: 9, min: 6, max: 28 },
      { key: 'margin', label: 'Margin', type: 'number', default: 28, min: 8, max: 120 },
    ],
    run: lazy((m) => one(m.addHeaderFooter)),
  },
  {
    id: 'crop',
    name: 'Crop PDF',
    cardName: 'Crop',
    blurb: 'Trim margins with a non-destructive crop box.',
    description: 'Set the visible area in millimetres, points or percent. The crop is reversible — and we tell you that up front.',
    category: 'Edit & sign',
    icon: Crop,
    accept: 'pdf',
    ready: true,
    fields: [
      {
        key: 'unit',
        label: 'Units',
        type: 'select',
        default: 'mm',
        options: [
          { value: 'mm', label: 'Millimetres' },
          { value: '%', label: 'Percent of page' },
          { value: 'pt', label: 'Points' },
        ],
      },
      { key: 'top', label: 'Top', type: 'number', default: 10, min: 0, max: 500 },
      { key: 'right', label: 'Right', type: 'number', default: 10, min: 0, max: 500 },
      { key: 'bottom', label: 'Bottom', type: 'number', default: 10, min: 0, max: 500 },
      { key: 'left', label: 'Left', type: 'number', default: 10, min: 0, max: 500 },
    ],
    tip: 'A crop box hides content visually. It does not delete it. Use Sanitize + a destructive re-render if you need it gone for good.',
    run: lazy((m) => one(m.cropPdf)),
  },
  {
    id: 'resize',
    name: 'Resize PDF',
    cardName: 'Resize',
    blurb: 'A4, Letter, Legal — fit or stretch.',
    description: 'Re-lay every page onto a standard paper size. Useful for printing and submission portals.',
    category: 'Edit & sign',
    icon: Scaling,
    accept: 'pdf',
    ready: true,
    fields: [
      {
        key: 'size',
        label: 'Paper size',
        type: 'select',
        default: 'A4',
        options: [
          { value: 'A4', label: 'A4' },
          { value: 'A3', label: 'A3' },
          { value: 'A5', label: 'A5' },
          { value: 'Letter', label: 'US Letter' },
          { value: 'Legal', label: 'US Legal' },
          { value: 'Tabloid', label: 'Tabloid' },
        ],
      },
      {
        key: 'orientation',
        label: 'Orientation',
        type: 'select',
        default: 'portrait',
        options: [
          { value: 'portrait', label: 'Portrait' },
          { value: 'landscape', label: 'Landscape' },
        ],
      },
      {
        key: 'fit',
        label: 'Fit',
        type: 'select',
        default: 'contain',
        options: [
          { value: 'contain', label: 'Contain (keep proportions)' },
          { value: 'stretch', label: 'Stretch (fill the page)' },
        ],
      },
    ],
    tip: 'Resizing re-renders pages. Text becomes an image, so do this last.',
    run: lazy((m) => one(m.resizePdf)),
  },

  /* ── Convert ────────────────────────────────────────────────────────────── */
  {
    id: 'pdf-to-images',
    name: 'PDF to Images',
    cardName: 'PDF to JPG',
    blurb: 'PNG, JPG or WebP at the DPI you choose.',
    description: 'Export every page as a crisp image. Download individually or as a ZIP.',
    category: 'Convert',
    icon: Images,
    accept: 'pdf',
    ready: true,
    popular: true,
    fields: [
      {
        key: 'format',
        label: 'Format',
        type: 'select',
        default: 'png',
        options: [
          { value: 'png', label: 'PNG — lossless' },
          { value: 'jpg', label: 'JPG — smaller' },
          { value: 'webp', label: 'WebP — modern' },
        ],
      },
      {
        key: 'dpi',
        label: 'Resolution',
        type: 'select',
        default: '150',
        options: [
          { value: '72', label: '72 DPI — screen draft' },
          { value: '150', label: '150 DPI — everyday' },
          { value: '300', label: '300 DPI — print' },
          { value: '400', label: '400 DPI — archival' },
        ],
      },
    ],
    run: lazy((m) => one(m.pdfToImages)),
  },
  {
    id: 'images-to-pdf',
    name: 'Images to PDF',
    cardName: 'JPG to PDF',
    blurb: 'JPG, PNG and WebP into one tidy PDF.',
    description: 'Arrange images in any order and lay them out on A4, Letter, or at their native size.',
    category: 'Convert',
    icon: ImagePlus,
    accept: 'image',
    multiple: true,
    ready: true,
    popular: true,
    fields: [
      {
        key: 'size',
        label: 'Page size',
        type: 'select',
        default: 'A4',
        options: [
          { value: 'A4', label: 'A4' },
          { value: 'Letter', label: 'US Letter' },
          { value: 'A3', label: 'A3' },
          { value: 'fit', label: 'Fit each image exactly' },
        ],
      },
      {
        key: 'orientation',
        label: 'Orientation',
        type: 'select',
        default: 'auto',
        options: [
          { value: 'auto', label: 'Auto (per image)' },
          { value: 'portrait', label: 'Portrait' },
          { value: 'landscape', label: 'Landscape' },
        ],
      },
      { key: 'margin', label: 'Margin', type: 'range', default: 0, min: 0, max: 40, step: 1, suffix: 'mm' },
    ],
    run: lazy((m) => m.imagesToPdf),
  },
  {
    id: 'pdf-to-text',
    name: 'PDF to Text',
    cardName: 'PDF to text',
    blurb: 'Extract the real text layer, page by page.',
    description: 'Pulls selectable text out of the PDF. If the document is a scan with no text layer, it tells you instead of returning garbage.',
    category: 'Convert',
    icon: FileText,
    accept: 'pdf',
    ready: true,
    fields: [],
    run: lazy((m) => (files, _o, progress) => m.pdfToText(files[0], progress)),
  },
  {
    id: 'text-to-pdf',
    name: 'Text to PDF',
    cardName: 'Text to PDF',
    blurb: 'Turn plain text into a clean, readable PDF.',
    description: 'Paste notes, markdown-ish text or a draft. Docsy wraps it, paginates it, and exports a real PDF.',
    category: 'Convert',
    icon: Type,
    accept: 'none',
    ready: true,
    fields: [
      { key: 'text', label: 'Your text', type: 'textarea', default: '', rows: 10, placeholder: 'Paste anything here…' },
      {
        key: 'size',
        label: 'Page size',
        type: 'select',
        default: 'A4',
        options: [
          { value: 'A4', label: 'A4' },
          { value: 'Letter', label: 'US Letter' },
          { value: 'A5', label: 'A5' },
        ],
      },
      { key: 'fontSize', label: 'Font size', type: 'number', default: 12, min: 7, max: 30 },
      {
        key: 'orientation',
        label: 'Orientation',
        type: 'select',
        default: 'portrait',
        options: [
          { value: 'portrait', label: 'Portrait' },
          { value: 'landscape', label: 'Landscape' },
        ],
      },
      { key: 'fileName', label: 'File name', type: 'text', default: 'docsy-text' },
    ],
    run: lazy((m) => (_files, opts, progress) => m.textToPdf(opts, progress)),
  },
  {
    id: 'contact-sheet',
    name: 'Contact Sheet',
    cardName: 'Contact sheet',
    blurb: 'Every page as a labelled thumbnail grid.',
    description: 'Print a visual index of a long document. Great for proofing, archives and shoot lists.',
    category: 'Convert',
    icon: Layers,
    accept: 'pdf',
    ready: true,
    fields: [
      { key: 'columns', label: 'Columns', type: 'number', default: 4, min: 2, max: 6 },
      { key: 'rows', label: 'Rows', type: 'number', default: 5, min: 2, max: 8 },
    ],
    run: lazy((m) => one(m.contactSheet)),
  },
  {
    id: 'pdf-to-zip',
    name: 'PDF to ZIP',
    cardName: 'Bundle to ZIP',
    blurb: 'Bundle a batch of PDFs for one download.',
    description: 'Drop multiple PDFs and get a single tidy archive. No compression games, just packaging.',
    category: 'Convert',
    icon: Archive,
    accept: 'pdf',
    multiple: true,
    ready: true,
    fields: [],
    run: lazy((m) => (files) => m.pdfToZip(files)),
  },

  /* ── Clean & inspect ────────────────────────────────────────────────────── */
  {
    id: 'sanitize',
    name: 'Sanitize PDF',
    cardName: 'Sanitize',
    blurb: 'Strip metadata, scripts, attachments, annotations.',
    description:
      'The one you send when you do not want to leak where the file came from. Removes document info, XMP, scripts, the name tree and annotation references.',
    category: 'Clean & inspect',
    icon: ShieldCheck,
    accept: 'pdf',
    ready: true,
    popular: true,
    fields: [],
    tip: 'This is a privacy cleanup, not a redaction. Hidden text inside the page content is a different problem — Redact is on the roadmap.',
    run: lazy((m) => (files) => m.sanitizePdf(files[0])),
  },
  {
    id: 'metadata',
    name: 'Metadata Editor',
    cardName: 'Metadata',
    blurb: 'Read and rewrite title, author, subject, keywords.',
    description: 'See what your document says about you, then change it before you send it.',
    category: 'Clean & inspect',
    icon: Tags,
    accept: 'pdf',
    ready: true,
    fields: [
      { key: 'title', label: 'Title', type: 'text', default: '' },
      { key: 'author', label: 'Author', type: 'text', default: '' },
      { key: 'subject', label: 'Subject', type: 'text', default: '' },
      { key: 'keywords', label: 'Keywords', type: 'text', default: '', help: 'Comma-separated.' },
    ],
    run: lazy((m) => (files, opts) => m.editMetadata(files[0], opts)),
  },
  {
    id: 'inspect',
    name: 'Inspect PDF',
    cardName: 'Inspect',
    blurb: 'Pages, size, dimensions, text layer, metadata.',
    description: 'A quick health check. Is it a scan? Is it encrypted? What does it say about its author? No file leaves the tab.',
    category: 'Clean & inspect',
    icon: FileSearch,
    accept: 'pdf',
    ready: true,
    popular: true,
    fields: [],
    run: lazy((m) => (files, _o, progress) => m.inspectPdf(files[0], progress)),
  },
  {
    id: 'flatten',
    name: 'Flatten PDF',
    cardName: 'Flatten',
    blurb: 'Bake forms and annotations into the page.',
    description: 'Turn interactive elements into permanent ink so nothing shifts when someone else opens it.',
    category: 'Clean & inspect',
    icon: Layers,
    accept: 'pdf',
    ready: true,
    fields: [
      {
        key: 'dpi',
        label: 'Render quality',
        type: 'select',
        default: '150',
        options: [
          { value: '96', label: '96 DPI — small' },
          { value: '150', label: '150 DPI — balanced' },
          { value: '300', label: '300 DPI — sharp' },
        ],
      },
    ],
    tip: 'Flattening here means re-rendering pages. Text stops being selectable and links stop working. That is what “flattened” means.',
    run: lazy((m) => one(m.flattenPdf)),
  },
  {
    id: 'recolor',
    name: 'Invert / Grayscale',
    cardName: 'Invert / gray',
    blurb: 'Dark-mode PDFs, or calm monochrome.',
    description: 'Flip the colours for a dark reading mode, or strip colour for cheaper, cleaner printing.',
    category: 'Clean & inspect',
    icon: Palette,
    accept: 'pdf',
    ready: true,
    fields: [
      {
        key: 'mode',
        label: 'Effect',
        type: 'select',
        default: 'invert',
        options: [
          { value: 'invert', label: 'Invert colours (dark mode)' },
          { value: 'grayscale', label: 'Grayscale' },
        ],
      },
    ],
    run: lazy((m) => one(m.recolorPdf)),
  },
  {
    id: 'compare',
    name: 'Compare PDFs',
    cardName: 'Compare',
    blurb: 'See what changed between two versions.',
    description: 'A visual, side-by-side page comparison with changed pages highlighted. Coming after the core tools are bulletproof.',
    category: 'Clean & inspect',
    icon: GitCompare,
    accept: 'pdf',
    multiple: true,
    ready: false,
    soonNote: 'Pixel-level diffing is easy; a diff that is actually useful is not. This ships when it can be trusted.',
  },
  {
    id: 'ocr',
    name: 'OCR Scanned PDF',
    cardName: 'OCR',
    blurb: 'Make scans searchable, in your browser.',
    description: 'Tesseract running locally will recognise text in scans. No page images are uploaded.',
    category: 'Convert',
    icon: ScanLine,
    accept: 'pdf',
    ready: false,
    soonNote: 'OCR needs 10–20 MB of language data per language. We will not quietly stream that from a third-party CDN. It ships self-hosted and labelled.',
  },
  {
    id: 'redact',
    name: 'Redact PDF',
    cardName: 'Redact',
    blurb: 'Truly remove sensitive text and areas.',
    description: 'Pattern-assisted redaction that rasterises the page, so the hidden text is genuinely gone — not just covered with a black box.',
    category: 'Clean & inspect',
    icon: Eraser,
    accept: 'pdf',
    ready: false,
    soonNote: 'This is a safety feature. It ships only when the “remove, not cover” guarantee can be tested end to end.',
  },
  {
    id: 'protect',
    name: 'Protect PDF',
    cardName: 'Protect',
    blurb: 'Password-encrypt a document.',
    description: 'AES encryption handled locally, with the password never leaving the tab.',
    category: 'Clean & inspect',
    icon: Lock,
    accept: 'pdf',
    ready: false,
    soonNote: 'pdf-lib cannot encrypt. Shipping a half-working “protection” is worse than shipping none. Waiting on a real WASM crypto layer.',
  },
  {
    id: 'unlock',
    name: 'Unlock PDF',
    cardName: 'Unlock',
    blurb: 'Remove a password you own.',
    description: 'Decrypt a document you have the password for. Never a brute-force tool.',
    category: 'Clean & inspect',
    icon: Unlock,
    accept: 'pdf',
    ready: false,
    soonNote: 'Only for files you own the password to. The honest version needs a real decryption library, not a pretend one.',
  },
  {
    id: 'extract-images',
    name: 'Extract Images',
    cardName: 'Extract images',
    blurb: 'Pull every embedded image out of a PDF.',
    description: 'Get the original photos, logos and diagrams, without screenshots.',
    category: 'Convert',
    icon: Images,
    accept: 'pdf',
    ready: false,
    soonNote: 'Extracting original image streams (not screenshots) is fiddly. Coming in a later build.',
  },
  {
    id: 'repair',
    name: 'Repair PDF',
    cardName: 'Repair',
    blurb: 'Attempt recovery of a damaged document.',
    description: 'When a PDF refuses to open, Docsy will try to salvage what it can.',
    category: 'Clean & inspect',
    icon: Wrench,
    accept: 'pdf',
    ready: false,
    soonNote: 'No promises without a real parser. It will say “recovered 4 of 12 pages”, never “fixed”.',
  },
  {
    id: 'qr',
    name: 'QR in PDF',
    cardName: 'Add QR',
    blurb: 'Generate a QR code and stamp it on a page.',
    description: 'Add a link, tracking code or vCard as a scannable code.',
    category: 'Edit & sign',
    icon: QrCode,
    accept: 'pdf',
    ready: false,
    soonNote: 'Queued behind the higher-value tools. All generation will be local.',
  },
  {
    id: 'forms',
    name: 'Fill Forms',
    cardName: 'Fill forms',
    blurb: 'Detect and fill PDF form fields.',
    description: 'Type into text fields, tick boxes, sign. Export a filled copy.',
    category: 'Edit & sign',
    icon: Sparkles,
    accept: 'pdf',
    ready: false,
    soonNote: 'Form detection is inconsistent across real-world PDFs. It ships when it handles the ugly ones.',
  },
  {
    id: 'pages',
    name: 'Page Calculator',
    cardName: 'Page count',
    blurb: 'Total pages and size across many PDFs.',
    description: 'Drop a stack of documents and get a total page count and combined size.',
    category: 'Clean & inspect',
    icon: Files,
    accept: 'pdf',
    multiple: true,
    ready: false,
    soonNote: 'Merged into Inspect for now. A batch version lands with the batch workspace.',
  },
  {
    id: 'unlock-tools',
    name: 'Batch Workspace',
    cardName: 'Batch',
    blurb: 'Run one recipe across many documents.',
    description: 'A queue, a recipe, and a ZIP at the end. The thing power users keep asking for.',
    category: 'Essentials',
    icon: Sparkles,
    accept: 'pdf',
    multiple: true,
    ready: false,
    soonNote: 'The tray already keeps your files across tools. Batch execution is the next step.',
  },
]

export const CATEGORIES: Category[] = ['Essentials', 'Edit & sign', 'Convert', 'Clean & inspect']

export const READY_TOOLS = TOOLS.filter((t) => t.ready)
export const POPULAR_TOOLS = TOOLS.filter((t) => t.popular)

export function getTool(id: string | undefined): Tool | undefined {
  return TOOLS.find((t) => t.id === id)
}

export { range }
